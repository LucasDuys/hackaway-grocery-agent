import { AhScraper } from './ah-scraper'
import { JumboScraper } from './jumbo-scraper'
import { LidlScraper } from './lidl-scraper'
import { PicnicScraper } from './picnic-scraper'
import { PlusScraper } from './plus-scraper'
import { AldiScraper } from './aldi-scraper'
import { ScraperDbWriter } from './db-writer'
import type { SupabaseClient } from './db-writer'
import type { BaseScraper } from './base-scraper'
import type { StoreSlug, ScrapeResult } from './types'

export interface StoreResult {
  storeSlug: string
  productsScraped: number
  errorsCount: number
  durationMs: number
  status: 'completed' | 'failed'
}

export interface OrchestratorResult {
  totalProducts: number
  totalErrors: number
  storeResults: StoreResult[]
  durationMs: number
}

const SCRAPER_MAP: Record<StoreSlug, () => BaseScraper> = {
  ah: () => new AhScraper(),
  jumbo: () => new JumboScraper(),
  lidl: () => new LidlScraper(),
  picnic: () => new PicnicScraper(),
  plus: () => new PlusScraper(),
  aldi: () => new AldiScraper(),
}

const ALL_SLUGS: StoreSlug[] = ['ah', 'jumbo', 'lidl', 'picnic', 'plus', 'aldi']

/**
 * Orchestrates running all 6 Dutch supermarket scrapers sequentially,
 * writing results to Supabase, and logging each run to scrape_logs.
 */
export class ScraperOrchestrator {
  private writer: ScraperDbWriter

  constructor(private readonly supabase: SupabaseClient) {
    this.writer = new ScraperDbWriter(supabase)
  }

  /**
   * Run all 6 scrapers sequentially, write results to DB,
   * log each run to scrape_logs table.
   */
  async runAll(): Promise<OrchestratorResult> {
    return this.runStores(ALL_SLUGS)
  }

  /**
   * Run a single scraper by store slug.
   */
  async runStore(slug: StoreSlug): Promise<OrchestratorResult> {
    return this.runStores([slug])
  }

  /**
   * Run a subset of scrapers by store slug.
   */
  async runStores(slugs: StoreSlug[]): Promise<OrchestratorResult> {
    const overallStart = Date.now()
    const storeResults: StoreResult[] = []

    for (const slug of slugs) {
      const storeResult = await this.runSingleScraper(slug)
      storeResults.push(storeResult)
    }

    const totalProducts = storeResults.reduce((sum, r) => sum + r.productsScraped, 0)
    const totalErrors = storeResults.reduce((sum, r) => sum + r.errorsCount, 0)

    return {
      totalProducts,
      totalErrors,
      storeResults,
      durationMs: Date.now() - overallStart,
    }
  }

  /**
   * Run a single scraper, write its results to DB, and log the run.
   * If the scraper throws, the store is marked as 'failed' but
   * execution continues for other stores.
   */
  private async runSingleScraper(slug: StoreSlug): Promise<StoreResult> {
    const factory = SCRAPER_MAP[slug]
    if (!factory) {
      return {
        storeSlug: slug,
        productsScraped: 0,
        errorsCount: 1,
        durationMs: 0,
        status: 'failed',
      }
    }

    const scraper = factory()
    let scrapeResult: ScrapeResult

    try {
      scrapeResult = await scraper.scrape()
    } catch (err) {
      // Scraper threw an unrecoverable error
      return {
        storeSlug: slug,
        productsScraped: 0,
        errorsCount: 1,
        durationMs: 0,
        status: 'failed',
      }
    }

    // Write scraped products to DB
    const writeResult = await this.writer.writeResults(scrapeResult)

    // Log the scrape run
    await this.writer.logScrapeRun({ ...scrapeResult, writeResult })

    return {
      storeSlug: slug,
      productsScraped: scrapeResult.products.length,
      errorsCount: scrapeResult.errors.length + writeResult.errors,
      durationMs: scrapeResult.durationMs,
      status: 'completed',
    }
  }
}
