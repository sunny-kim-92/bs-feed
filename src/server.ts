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

    async function myScheduledFunction() {
      const mostRecentPage = await prisma.pageRank.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
      });
      let batch = mostRecentPage?.batch
      if(!batch){
        batch = 1
      }
//       let res: Array<{ id: number, linkId: number, likesCount: number, repostsCount: number, repliesCount: number, url: string, title: string, description: string, postCreatedAt: Date, likes: number, reposts: number, replies: number, date: string, score: number }> = await prisma.$queryRaw`WITH 
// RecentPosts AS (
//     SELECT did, createdAt
//     FROM Post
//     WHERE createdAt >= NOW() - INTERVAL 5 MINUTE
// ),
// LikeCounts AS (
//     SELECT postId, COUNT(*) AS likes
//     FROM \`Like\`
//     WHERE createdAt >= NOW() - INTERVAL 5 MINUTE
//     GROUP BY postId
//     HAVING COUNT(*) >= 5
// ),
// RepostCounts AS (
//     SELECT postId, COUNT(*) AS reposts
//     FROM Repost
//     WHERE createdAt >= NOW() - INTERVAL 5 MINUTE
//     GROUP BY postId
//     HAVING COUNT(*) >= 2
// ),
// ReplyCounts AS (
//     SELECT postId, COUNT(*) AS replies
//     FROM Reply
//     WHERE createdAt >= NOW() - INTERVAL 5 MINUTE
//     GROUP BY postId
//     HAVING COUNT(*) >= 1
// )
// SELECT 
//     l.*, 
//     MIN(p.createdAt) AS postCreatedAt,
//     SUM(COALESCE(lc.likes, 0)) AS likesCount,
//     SUM(COALESCE(rc.reposts, 0)) AS repostsCount,
//     SUM(COALESCE(rp.replies, 0)) AS repliesCount
// FROM Link l
// JOIN Post p ON l.id = p.linkId
// LEFT JOIN LikeCounts lc ON p.did = lc.postId
// LEFT JOIN RepostCounts rc ON p.did = rc.postId
// LEFT JOIN ReplyCounts rp ON p.did = rp.postId
// WHERE 
//     p.did IN (SELECT did FROM RecentPosts)
//     OR p.did IN (SELECT postId FROM LikeCounts)
//     OR p.did IN (SELECT postId FROM RepostCounts)
//     OR p.did IN (SELECT postId FROM ReplyCounts)
// GROUP BY l.id;`

let res: Array<{ id: number, linkId: number, url: string, title: string, description: string, postCreatedAt: Date, postId: number, score: number }> = await prisma.$queryRaw`SELECT 
    l.id AS linkId, 
    l.url AS url, 
    l.title AS title,
    l.description AS description,
    p.id AS postId,
    p.createdAt,
    (SELECT COUNT(*) FROM Post p2 WHERE p2.linkId = l.id) AS postCount,
    (
        (COUNT(likes.id) + COUNT(reposts.id) * 2 + COUNT(replies.id) * 3)
    ) AS score
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
ORDER BY score DESC
LIMIT 25;`

for(let row of res){
  console.log(res)
}


    // const pages: Array<{
    //   linkId: number,
    //   url: string,
    //   title: string,
    //   description: string,
    //   likes: number,
    //   reposts: number,
    //   replies: number,
    //   createdAt: Date,
    //   score: number
    // }> = []
    //   for (let row of res) {
    //     let obj: {
    //       linkId: number,
    //       url: string,
    //       title: string,
    //       description: string,
    //       likes: number,
    //       reposts: number,
    //       replies: number,
    //       createdAt: Date,
    //       score: number
    //     } = {
    //       linkId: row.id,
    //       url: row.url,
    //       title: row.title,
    //       description: row.description,
    //       likes: Number(row.likesCount),
    //       reposts: Number(row.repostsCount),
    //       replies: Number(row.repliesCount),
    //       createdAt: row.postCreatedAt,
    //       score: (Math.log(row.likesCount + 1) / Math.log(2)) + (Math.log(row.repostsCount + 1) / Math.log(1.5)) + (Math.log(row.repliesCount + 1) / Math.log(1.1))
    //     }
    //     pages.push(obj)
    //   }
    //   await prisma.pageRank.createMany({ data: pages })
    }

    // setInterval(myScheduledFunction, 300000);
    myScheduledFunction()
    return this.server
  }
}

export default FeedGenerator
