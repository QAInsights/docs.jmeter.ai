import { describe, it, expect } from 'vitest';
import { jsr223Recipes, getJsr223Recipes } from '../../src/lib/mcp/jsr223-recipes.mjs';

describe('jsr223-recipes', () => {
  it('contains curated recipes with valid fields', () => {
    expect(jsr223Recipes.length).toBeGreaterThanOrEqual(5);
    for (const recipe of jsr223Recipes) {
      expect(recipe.id).toBeTruthy();
      expect(recipe.title).toBeTruthy();
      expect(recipe.code).toBeTruthy();
      expect(recipe.jmeterVariables.length).toBeGreaterThan(0);
    }
  });

  it('filters recipes by keyword query', () => {
    const jwtRecipes = getJsr223Recipes('jwt');
    expect(jwtRecipes.length).toBeGreaterThan(0);
    expect(jwtRecipes[0].id).toBe('jwt_parse_expiry');

    const hmacRecipes = getJsr223Recipes('hmac');
    expect(hmacRecipes.length).toBeGreaterThan(0);
    expect(hmacRecipes[0].id).toBe('hmac_sha256_signer');
  });

  it('returns all recipes when query is empty', () => {
    expect(getJsr223Recipes().length).toBe(jsr223Recipes.length);
  });
});
