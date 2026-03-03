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

      if (!apiKey || !cseId) {
        this.logger.warn(`Image search skipped: missing API_KEY=${!!apiKey} CSE_ID=${!!cseId}`);
        return null;
      }

      const customSearch = google.customsearch('v1');
      const res = await customSearch.cse.list({
        auth: apiKey,
        cx: cseId,
        q: query,
        searchType: 'image',
        num: 1,
        safe: 'active',
        imgSize: 'medium',
      });

      const items = res.data.items;
      if (items && items.length > 0) {
        this.logger.log(`Image found for "${query}": ${items[0].link}`);
        return items[0].link || null;
      }

      this.logger.warn(`No image results for "${query}"`);
      return null;
    } catch (error) {
      this.logger.warn(`Image search failed for "${query}": ${error}`);
      return null;
    }
  }
}
