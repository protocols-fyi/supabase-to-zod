import { generate } from 'ts-to-zod';

import fs from 'node:fs/promises';
import { join } from 'node:path';
import prettier from 'prettier';

import { z } from 'zod';
import {
  transformTypes,
  getImportPath,
  transformTypesOptionsSchema,
} from './lib';

const simplifiedJSDocTagSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
});

const getSchemaNameSchema = z.function().args(z.string()).returns(z.string());

const nameFilterSchema = z.function().args(z.string()).returns(z.boolean());

const jSDocTagFilterSchema = z
  .function()
  .args(z.array(simplifiedJSDocTagSchema))
  .returns(z.boolean());

export const supabaseToZodOptionsSchema = transformTypesOptionsSchema
  .omit({ sourceText: true })
  .extend({
    input: z.string(),
    output: z.string(),
    skipValidation: z.boolean().optional(),
    maxRun: z.number().optional(),
    nameFilter: nameFilterSchema.optional(),
    jsDocTagFilter: jSDocTagFilterSchema.optional(),
    getSchemaName: getSchemaNameSchema.optional(),
    keepComments: z.boolean().optional().default(false),
    skipParseJSDoc: z.boolean().optional().default(false),
  });

export type SupabaseToZodOptions = z.infer<typeof supabaseToZodOptionsSchema>;

export default async function supabaseToZod(opts: SupabaseToZodOptions) {
  const inputPath = join(process.cwd(), opts.input);
  const outputPath = join(process.cwd(), opts.output);

  const sourceText = await fs.readFile(inputPath, 'utf-8');

  const parsedTypes = transformTypes({ sourceText, ...opts });

  const { getZodSchemasFile, errors } = generate({
    sourceText: parsedTypes,
    ...opts,
  });

  if (errors.length > 0) {
    console.error(errors.join('\n'));
  }

  const zodSchemasFile = getZodSchemasFile(
    getImportPath(outputPath, inputPath),
  );

  const prettierConfig = await prettier.resolveConfig(process.cwd());

  await fs.writeFile(
    outputPath,
    await prettier.format(zodSchemasFile, {
      parser: 'babel-ts',
      ...prettierConfig,
    }),
  );
}
