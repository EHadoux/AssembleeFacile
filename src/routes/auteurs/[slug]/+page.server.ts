import { getAllAuteurs, getAuteurBySlug, getPostsByAuteur, slugify } from '$lib/server/content';
import { loadDeclarations } from '$lib/server/declarations';
import { getAllGroupes } from '$lib/server/groupes';
import { findDeputeByNameInDb, getAuthorCounts, getTopCosignataires } from '$lib/server/queries';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const name = getAuteurBySlug(params.slug);
  if (!name) error(404, 'Auteur introuvable');

  const posts = getPostsByAuteur(name);
  const totalPosts = posts.length;

  const dep = findDeputeByNameInDb(name);
  const counts = dep ? getAuthorCounts(dep.id) : { count_auteur: totalPosts, count_cosig: 0 };
  const groupes = getAllGroupes();
  const groupe = dep ? (groupes.find((g) => g.abrev === dep.groupe_abrev) ?? null) : null;
  // TODO: once the DB is the single source of truth for authors, remove this filter —
  // all cosignataires will have their own page and the slug check will be unnecessary.
  const auteurSlugs = new Set(getAllAuteurs().map((n) => slugify(n)));
  const rawCosignataires = dep ? getTopCosignataires(dep.id, 10) : [];
  const cosignataires = rawCosignataires.filter(({ name }) => auteurSlugs.has(slugify(name))).slice(0, 5);

  const tagCounts = new Map<string, { tag: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.tags) {
      const key = slugify(tag);
      const ex = tagCounts.get(key);
      if (ex) ex.count++;
      else tagCounts.set(key, { tag, count: 1 });
    }
  }
  const topTags = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const declarations = dep ? loadDeclarations(dep.id) : [];

  return { name, posts, totalPosts, dep, groupe, topTags, cosignataires, counts, declarations };
};

export function entries() {
  return getAllAuteurs().map((name) => ({ slug: slugify(name) }));
}
