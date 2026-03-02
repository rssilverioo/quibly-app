import { Global, Module } from '@nestjs/common';
import { ImageSearchService } from './image-search.service';

@Global()
@Module({
  providers: [ImageSearchService],
  exports: [ImageSearchService],
})
export class ImageSearchModule {}
