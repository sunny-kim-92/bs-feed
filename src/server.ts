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

    // async function myScheduledFunction() {
      // let end_date = new Date()
      // let start_date = new Date()
      // start_date.setMinutes(start_date.getMinutes() - 5)
      // let res: Array<{ linkId: string, url: string, title: string, description: string, postCreatedAt: Date, likes: number, reposts: number, replies: number, date: string, score: number }> = await prisma.$queryRaw`WITH LikeCounts AS (SELECT postId, COUNT(*) AS likes FROM 'Like' WHERE createdAt > ${start_date.toISOString()} and createdAt < ${end_date.toISOString()} GROUP BY postId), RepostCounts AS (SELECT postId, COUNT(*) AS reposts FROM 'Repost' WHERE createdAt > ${start_date.toISOString()} and createdAt < ${end_date.toISOString()} GROUP BY postId), ReplyCounts AS (SELECT postId, COUNT(*) AS replies FROM Reply WHERE createdAt > ${start_date.toISOString()} AND createdAt < ${end_date.toISOString()} GROUP BY postId) SELECT l.id AS linkId, l.url, l.title, l.description, p.createdAt AS postCreatedAt, COALESCE(lc.likes, 0) AS likes, COALESCE(rc.reposts, 0) AS reposts, COALESCE(rp.replies, 0) AS replies FROM Link l LEFT JOIN Post p ON l.id = p.linkId LEFT JOIN LikeCounts lc ON p.did = lc.postId LEFT JOIN RepostCounts rc ON p.did = rc.postId LEFT JOIN ReplyCounts rp ON p.did = rp.postId WHERE (COALESCE(rc.reposts, 0) >= 1 OR COALESCE(lc.likes, 0) >= 1 OR COALESCE(rp.replies, 0) >= 1) OR (p.createdAt > ${start_date.toISOString()} and p.createdAt < ${end_date.toISOString()}) LIMIT 50`

      // for (let row of res) {
      //   row.date = end_date.toISOString()
      //   row.score = (Math.log(row.likes + 1) / Math.log(2)) + (Math.log(row.reposts + 1) / Math.log(1.5)) + (Math.log(row.replies + 1) / Math.log(1.1))
      // }
      // await prisma.pageRank.createMany({ data: res })
    // }

    // setInterval(myScheduledFunction, 300000);
    return this.server
  }
}

export default FeedGenerator
