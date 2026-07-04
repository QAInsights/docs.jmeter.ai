import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { ExtendDocsSchema } from 'lucode-starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: ExtendDocsSchema.extend({
        jsonLd: z.record(z.string(), z.any()).optional(),
        seoTitle: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        guideType: z.enum(['tutorial', 'how-to', 'reference', 'concept', 'troubleshooting']).optional(),
        estimatedReadTime: z.string().optional(),
        lastVerified: z.string().optional(),
        canonicalTopic: z.string().optional(),
      }),
    }),
  }),
};
