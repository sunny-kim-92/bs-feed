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
    // for (const post of ops.likes.creates) {
    //   console.log(post)
    // }
    // for (const post of ops.reposts.creates) {
    //   console.log(post)
    // }
    // console.log(Object.keys(ops.likes.creates[0].record))
    // console.log(Object.keys(ops.posts.creates[0].record))
    // console.log(Object.keys(ops.reposts.creates[0].record))
    // console.log(Object.keys(ops.follows.creates[0].record))

    const date = new Date().toISOString().substring(0, 10)
    const repliesToCreate: { postId: string, createdAt: string }[] = []
    const linksToCreate: { postId: string, url: string, title: string, description: string }[] = []
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        return create.record.text.trim() != ''
          // && create.record.langs?.indexOf('en') != -1
          && create.record.createdAt.substring(0, 10) == date
          && create.record.embed?.$type == 'app.bsky.embed.external'
          && ((create.record.embed.external as unknown) as { uri: string }).uri.substring(0, 19) != 'https://media.tenor'
          && ((create.record.embed.external as unknown) as { uri: string }).uri.length < 512
          && (create.record.embed.external as { uri: string }).uri
      })
      .map((create) => {
        if (create.record.reply) {
          repliesToCreate.push({ postId: create.record.reply.root.uri.substring(create.record.reply.root.uri.length - 12), createdAt: create.record.createdAt })
        }
        if (create.record.embed && create.record.embed.$type === 'app.bsky.embed.external') {
          const externalEmbed = create.record.embed.external as { uri: string, title: string, description: string }
          // linksToCreate.push({postId: create.uri.substring(create.uri.length-12), url: externalEmbed.uri, title: externalEmbed.title, description: externalEmbed.description})
          externalEmbed.uri = externalEmbed.uri.replace(/(^\w+:|^)\/\/|\/+$/, '')
          externalEmbed.uri = externalEmbed.uri.startsWith('www.') ? externalEmbed.uri.slice(4) : externalEmbed.uri
          if (externalEmbed.description.length >= 1000) {
            externalEmbed.description = externalEmbed.description.substring(0, 997) + '...'
          }
          const languages: { code: string }[] = []
          if (create.record.langs) {
            for (const lang of create.record.langs) {
              languages.push({ code: lang })
            }
          }
          return {
            text: create.record.text,
            createdAt: create.record.createdAt,
            authorId: create.author.substring(8),
            did: create.uri.substring(create.uri.length - 12),
            link: {
              connectOrCreate: {
                where: {
                  url: externalEmbed.uri
                },
                create: {
                  url: externalEmbed.uri,
                  title: externalEmbed.title,
                  description: externalEmbed.description
                }
              }
            },
            languages: {
              connect: languages
            }
          }
        }
      })
    if (postsToCreate.length > 0) {
      for (const post of postsToCreate.filter(p => p !== undefined)) {
        await this.prisma.post.create({ data: post })
      }
    }
    // if (linksToCreate) {
    //   await this.prisma.link.createMany({ data: linksToCreate })
    // }
    if (repliesToCreate) {
      for (const reply of repliesToCreate) {
        let postExists = await this.prisma.post.findUnique({ where: { did: reply.postId } })
        if (postExists) {
          await this.prisma.reply.create({ data: reply })
        }
      }
      // await this.prisma.reply.createMany({ data: repliesToCreate })
    }

    const likesToCreate = ops.likes.creates
      .map((create) => {
        return {
          postId: create.record.subject.uri.substring(create.record.subject.uri.length - 12),
          createdAt: create.record.createdAt,
        }
      })
    if (likesToCreate) {
      for (const like of likesToCreate) {
        let postExists = await this.prisma.post.findUnique({ where: { did: like.postId } })
        if (postExists) {
          await this.prisma.like.create({ data: like })
        }
      }
      // await this.prisma.like.createMany({ data: likesToCreate })
    }

    const repostsToCreate = ops.reposts.creates
      .map((create) => {
        return {
          postId: create.record.subject.uri.substring(create.record.subject.uri.length - 12),
          createdAt: create.record.createdAt,
        }
      })
    if (repostsToCreate) {
      for (const repost of repostsToCreate) {
        let postExists = await this.prisma.post.findUnique({ where: { did: repost.postId } })
        if (postExists) {
          await this.prisma.repost.create({ data: repost })
        }
      }
      // await this.prisma.repost.createMany({ data: repostsToCreate })
    }
  }
}
