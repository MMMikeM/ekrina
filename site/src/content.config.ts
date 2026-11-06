import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				// A phrase of the hero title to highlight. The title itself stays plain
				// text, because llms.txt prints it as it is.
				heroHighlight: z.string().optional(),
				// A line above the hero title that names what the product is.
				heroKicker: z.string().optional(),
				// Puts the live search demo beside the hero.
				heroDemo: z.boolean().optional(),
			}),
		}),
	}),
};
