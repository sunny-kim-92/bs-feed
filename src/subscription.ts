import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { PrismaClient } from '@prisma/client'
import { Database } from './db'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  constructor(public db: Database, public service: string, public prisma: PrismaClient) {
    super(db, service)
    this.prisma = prisma
  }
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    // for (const post of ops.posts.creates) {
    //   console.log(post)
    // }
    // for (const post of ops.follows.creates) {
    //   console.log(post)
    // }
    // console.log(Object.keys(ops.likes.creates[0].record))
    // console.log(Object.keys(ops.posts.creates[0].record))
    // console.log(Object.keys(ops.reposts.creates[0].record))
    // console.log(Object.keys(ops.follows.creates[0].record))

    const year = new Date().getFullYear()
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        return create.record.langs?.indexOf('en') != -1
          && create.record.text.trim() != ''
          && create.record.createdAt.substring(0, 4) == year.toString()
      })
      .map((create) => {
        return {
          text: create.record.text,
          createdAt: create.record.createdAt,
          authorId: create.author,
          did: create.uri
        }
      })
    if (postsToCreate) {
      await this.prisma.post.createMany({ data: postsToCreate })
    }

    const likesToCreate = ops.likes.creates
      .map((create) => {
        return {
          postId: create.record.subject.uri,
          createdAt: create.record.createdAt,
        }
      })
    if (likesToCreate) {
      await this.prisma.like.createMany({ data: likesToCreate })
    }

    const repostsToCreate = ops.reposts.creates
      .map((create) => {
        return {
          postId: create.record.subject.uri,
          createdAt: create.record.createdAt,
        }
      })
    if (repostsToCreate) {
      await this.prisma.repost.createMany({ data: likesToCreate })
    }
  }
}
