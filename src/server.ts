import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { PrismaClient } from '@prisma/client'
import { start } from 'repl'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSubscription
  public cfg: Config

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription,
    cfg: Config,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
  }

  static create(cfg: Config) {
    const app = express()
    const db = createDb(cfg.sqliteLocation)
    const prisma = new PrismaClient()
    const firehose = new FirehoseSubscription(db, cfg.subscriptionEndpoint, prisma)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    return new FeedGenerator(app, db, firehose, cfg)
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    const prisma = new PrismaClient()

    async function createRanks() {
      const mostRecentPage = await prisma.pageRank.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
      });
      let batch = mostRecentPage?.batch
      if (!batch) {
        batch = 1
      } else {
        batch++
      }

      let res: Array<{ id: number, linkId: number, url: string, title: string, description: string, postCreatedAt: Date, postId: number, score: number }> = await prisma.$queryRaw`SELECT 
l.id AS linkId, 
l.url AS url, 
l.title AS title,
l.description AS description,
p.id AS postId,
p.createdAt,
(COUNT(p.id) * 2 + COUNT(likes.id) * 1 + COUNT(reposts.id) * 3 + COUNT(replies.id) * 4) AS score,
(
    (COUNT(p.id) * 200 + COUNT(likes.id) * 100 + COUNT(reposts.id) * 300 + COUNT(replies.id) * 400)
    / (POW(LEAST(TIMESTAMPDIFF(MINUTE, p.createdAt, NOW()), 10080) + 300, 2))
) AS ranking
FROM Link l
JOIN Post p ON l.id = p.linkId
LEFT JOIN \`Like\` likes ON likes.postId = p.did AND likes.createdAt >= NOW() - INTERVAL 1 DAY
LEFT JOIN Repost reposts ON reposts.postId = p.did AND reposts.createdAt >= NOW() - INTERVAL 1 DAY
LEFT JOIN Reply replies ON replies.postId = p.did AND replies.createdAt >= NOW() - INTERVAL 1 DAY
WHERE 
p.createdAt >= NOW() - INTERVAL 1 DAY
OR (
    (SELECT COUNT(*) FROM \`Like\` WHERE postId = p.did AND createdAt >= NOW() - INTERVAL 1 DAY) >= 1
)
OR (
    (SELECT COUNT(*) FROM Repost WHERE postId = p.did AND createdAt >= NOW() - INTERVAL 1 DAY) >= 1
)
OR (
    (SELECT COUNT(*) FROM Reply WHERE postId = p.did AND createdAt >= NOW() - INTERVAL 1 DAY) >= 1
)
GROUP BY p.id
ORDER BY ranking DESC
LIMIT 25;`;

      const pages: Array<{
        linkId: number,
        url: string,
        title: string,
        description: string,
        createdAt: Date,
        score: number
      }> = []
      let rank = 1
      for (let row of res) {
        let obj: {
          linkId: number,
          url: string,
          title: string,
          description: string,
          createdAt: Date,
          score: number,
          batch: number,
          rank: number
        } = {
          linkId: row.id,
          url: row.url,
          title: row.title,
          description: row.description,
          createdAt: row.postCreatedAt,
          score: row.score,
          batch,
          rank
        }
        pages.push(obj)
        rank++
      }
      await prisma.pageRank.createMany({ data: pages })
    }

    async function deleteOldRows() {
      await prisma.$executeRaw`DELETE FROM \`Like\` WHERE createdAt < NOW() - INTERVAL 1 DAY;`
      await prisma.$executeRaw`DELETE FROM \`Repost\` WHERE createdAt < NOW() - INTERVAL 1 DAY;`
      await prisma.$executeRaw`DELETE FROM \`Reply\` WHERE createdAt < NOW() - INTERVAL 1 DAY;`
    }

    // Create new pageRanks every 5 minutes
    setInterval(() => createRanks(), 300000)
    // Delete old likes, reposts, and replies every day
    setInterval(() => deleteOldRows(), 86400000)
    return this.server
  }
}

export default FeedGenerator
