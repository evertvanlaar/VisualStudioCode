/**
 * n8n Code node: platte mapper voor Google Sheet (of volgende stap)
 *
 * Zet de Code node naam van je generator exact gelijk aan NAME_OF_GENERATOR_NODE
 * óf pas onderstaande string aan naar jouw node-naam in n8n.
 *
 * Uitvoer één item: schema_ready, seo_list_en, seo_list_el voor tabellen/Append/Update row.
 */

/** Exact zoals in de canvas (hoofdletters / spaties). Jouw node: "Generate SEO Blocks". */
const NAME_OF_GENERATOR_NODE = 'Generate SEO Blocks';

const seo = $(NAME_OF_GENERATOR_NODE).first()?.json ?? {};
if (!seo.schemaScript && !seo.schema_ready) {
  throw new Error(`Geen uitvoer van "${NAME_OF_GENERATOR_NODE}" (${Object.keys(seo).join(', ') || 'empty'})`);
}

return [
  {
    json: {
      schema_ready: seo.schema_ready ?? seo.schemaScript,
      seo_list_en: seo.seo_list_en ?? seo.htmlSectionEN,
      seo_list_el: seo.seo_list_el ?? seo.htmlSectionEL,
    },
  },
];
