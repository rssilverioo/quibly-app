import { IsString, IsOptional } from 'class-validator';

/**
 * Fields arrive as multipart form parts, so everything is a string —
 * `duration_sec` included. The controller does the conversion.
 */
export class CaptureLessonDto {
  /** Provisional only; replaced once the capture is structured. */
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  /** BCP-47, e.g. "pt-BR". Defaults to pt-BR. */
  @IsString()
  @IsOptional()
  language?: string;

  /** Recording length as measured on the device. */
  @IsString()
  @IsOptional()
  duration_sec?: string;
}
