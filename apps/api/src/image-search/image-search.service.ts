import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  constructor(private readonly configService: ConfigService) {}

  async searchImage(query: string): Promise<string | null> {
    try {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY', '');
      const cseId = this.configService.get<string>('GOOGLE_CSE_ID', '');

      if (!apiKey || !cseId) return null;

      const customSearch = google.customsearch('v1');
      const res = await customSearch.cse.list({
        auth: apiKey,
        cx: cseId,
        q: query,
        searchType: 'image',
        num: 1,
        safe: 'active',
      });

      const items = res.data.items;
      if (items && items.length > 0) {
        return items[0].link || null;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Image search failed for "${query}": ${error}`);
      return null;
    }
  }
}
