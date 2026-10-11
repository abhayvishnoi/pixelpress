import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

type ImageStatus = 'ready' | 'processing' | 'done' | 'error';
type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';
type Placement =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
type WatermarkFilter = 'none' | 'grayscale(1)' | 'sepia(0.85)' | 'contrast(1.35) saturate(1.3)';

interface ImageItem {
  id: number;
  file: File;
  previewUrl: string;
  outputUrl?: string;
  outputName?: string;
  status: ImageStatus;
  error?: string;
}

interface WatermarkMetrics {
  maxWidth: number;
  gap: number;
  overlayWidth: number;
  overlayHeight: number;
  fontSize: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnDestroy {
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('overlayInput') overlayInput?: ElementRef<HTMLInputElement>;
  @ViewChild('previewStage') previewStage?: ElementRef<HTMLDivElement>;

  readonly maxImages = 30;
  readonly formats: Array<{ value: OutputFormat; label: string }> = [
    { value: 'image/png', label: 'PNG' },
    { value: 'image/jpeg', label: 'JPG' },
    { value: 'image/webp', label: 'WebP' },
  ];
  readonly placements: Array<{ value: Placement; label: string }> = [
    { value: 'top-left', label: 'Top left' },
    { value: 'top-center', label: 'Top center' },
    { value: 'top-right', label: 'Top right' },
    { value: 'center-left', label: 'Middle left' },
    { value: 'center-center', label: 'Center' },
    { value: 'center-right', label: 'Middle right' },
    { value: 'bottom-left', label: 'Bottom left' },
    { value: 'bottom-center', label: 'Bottom center' },
    { value: 'bottom-right', label: 'Bottom right' },
  ];
  readonly watermarkFilters: Array<{ value: WatermarkFilter; label: string }> = [
    { value: 'none', label: 'Original' },
    { value: 'grayscale(1)', label: 'Grayscale' },
    { value: 'sepia(0.85)', label: 'Sepia' },
    { value: 'contrast(1.35) saturate(1.3)', label: 'Vivid' },
  ];

  images: ImageItem[] = [];
  overlayFile?: File;
  overlayPreviewUrl = '';
  watermarkText = '';
  watermarkColor = '#ffffff';
  watermarkFilter: WatermarkFilter = 'none';
  placement: Placement = 'bottom-right';
  overlayScale = 24;
  overlayOpacity = 90;
  outputFormat: OutputFormat = 'image/png';
  outputQuality = 90;
  isDragOver = false;
  isProcessing = false;
  isDarkMode = false;
  progress = 0;
  notice = '';
  noticeIsError = false;
  private nextId = 0;
  private sourceNaturalWidth = 0;
  private sourceNaturalHeight = 0;
  private overlayNaturalWidth = 0;
  private overlayNaturalHeight = 0;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
  }

  get completedCount(): number {
    return this.images.filter((image) => image.status === 'done').length;
  }

  get totalSize(): number {
    return this.images.reduce((total, image) => total + image.file.size, 0);
  }

  get canProcess(): boolean {
    return (
      this.images.length > 0 &&
      (!!this.overlayPreviewUrl || !!this.watermarkText.trim()) &&
      !this.isProcessing
    );
  }

  get hasWatermark(): boolean {
    return !!this.overlayPreviewUrl || !!this.watermarkText.trim();
  }

  get previewAspectRatio(): number {
    return this._previewAspectRatio;
  }

  private _previewAspectRatio = 4 / 3;

  get previewOverlayWidth(): number {
    return this.previewMetrics.overlayWidth * this.previewScaleFactor;
  }

  get previewWatermarkGap(): number {
    return this.previewMetrics.gap * this.previewScaleFactor;
  }

  get previewTextFontSize(): number {
    return this.previewMetrics.fontSize * this.previewScaleFactor;
  }

  get previewTextMaxWidth(): number {
    const metrics = this.previewMetrics;
    const reservedWidth = this.overlayPreviewUrl
      ? metrics.overlayWidth + metrics.gap
      : 0;
    return Math.max(0, metrics.maxWidth - reservedWidth) * this.previewScaleFactor;
  }

  private get previewMetrics(): WatermarkMetrics {
    return this.getWatermarkMetrics(
      this.sourceNaturalWidth,
      this.sourceNaturalHeight,
      this.overlayNaturalWidth,
      this.overlayNaturalHeight
    );
  }

  private get previewScaleFactor(): number {
    if (!this.sourceNaturalWidth || !this.previewStage) {
      return 0;
    }
    return this.previewStage.nativeElement.clientWidth / this.sourceNaturalWidth;
  }

  get isLossyFormat(): boolean {
    return this.outputFormat !== 'image/png';
  }

  ngOnDestroy(): void {
    this.releaseImageUrls();
    this.releaseOverlayUrl();
  }

  openImagePicker(): void {
    this.imageInput?.nativeElement.click();
  }

  openOverlayPicker(): void {
    this.overlayInput?.nativeElement.click();
  }

  onPlacementKeydown(event: KeyboardEvent, currentPlacement: Placement): void {
    const currentIndex = this.placements.findIndex(
      (option) => option.value === currentPlacement
    );
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % this.placements.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex =
          (currentIndex - 1 + this.placements.length) % this.placements.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.placements.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.placement = this.placements[nextIndex].value;
    const points = (event.currentTarget as HTMLElement)
      .parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    points?.[nextIndex]?.focus();
  }

  previewImageLoaded(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    if (image.naturalWidth && image.naturalHeight) {
      this.sourceNaturalWidth = image.naturalWidth;
      this.sourceNaturalHeight = image.naturalHeight;
      this._previewAspectRatio = image.naturalWidth / image.naturalHeight;
      this.changeDetector.markForCheck();
    }
  }

  overlayImageLoaded(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.overlayNaturalWidth = image.naturalWidth;
    this.overlayNaturalHeight = image.naturalHeight;
    this.changeDetector.markForCheck();
  }

  selectedImagesChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addImages(input.files ? Array.from(input.files) : []);
    input.value = '';
  }

  selectedOverlayChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.setNotice('Choose an image file for your logo watermark.', true);
      return;
    }

    this.releaseOverlayUrl();
    this.overlayFile = file;
    this.overlayPreviewUrl = URL.createObjectURL(file);
    this.notice = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    this.addImages(event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []);
  }

  removeImage(id: number): void {
    const image = this.images.find((item) => item.id === id);
    if (!image) {
      return;
    }

    URL.revokeObjectURL(image.previewUrl);
    if (image.outputUrl) {
      URL.revokeObjectURL(image.outputUrl);
    }
    this.images = this.images.filter((item) => item.id !== id);
    this.progress = this.images.length ? this.progress : 0;
    if (!this.images.length) {
      this._previewAspectRatio = 4 / 3;
    }
  }

  clearImages(): void {
    this.releaseImageUrls();
    this.images = [];
    this.progress = 0;
    this._previewAspectRatio = 4 / 3;
    this.sourceNaturalWidth = 0;
    this.sourceNaturalHeight = 0;
    this.notice = '';
  }

  clearOverlay(): void {
    this.releaseOverlayUrl();
    this.overlayNaturalWidth = 0;
    this.overlayNaturalHeight = 0;
    this.notice = '';
  }

  async processImages(): Promise<void> {
    if (!this.hasWatermark) {
      this.setNotice('Add a logo or brand text before exporting your batch.', true);
      return;
    }
    if (!this.images.length) {
      this.setNotice('Add at least one image to your batch.', true);
      return;
    }

    this.isProcessing = true;
    this.progress = 0;
    this.notice = '';

    let completed = 0;
    let failed = 0;

    for (const image of this.images) {
      image.status = 'processing';
      image.error = undefined;
      if (image.outputUrl) {
        URL.revokeObjectURL(image.outputUrl);
        image.outputUrl = undefined;
      }

      try {
        image.outputUrl = await this.renderImage(image);
        image.outputName = this.createOutputName(image.file.name);
        image.status = 'done';
        completed += 1;
      } catch (error: unknown) {
        image.status = 'error';
        image.error =
          error instanceof Error
            ? error.message
            : 'This image could not be processed. Try another file.';
        failed += 1;
      }

      this.progress = Math.round(((completed + failed) / this.images.length) * 100);
      this.changeDetector.markForCheck();
    }

    this.isProcessing = false;
    this.setNotice(
      failed
        ? `Finished ${completed} image${completed === 1 ? '' : 's'}; ${failed} could not be processed.`
        : `Done — ${completed} image${completed === 1 ? '' : 's'} ready to download.`,
      failed > 0
    );
    this.changeDetector.markForCheck();
  }

  downloadImage(image: ImageItem): void {
    if (!image.outputUrl || !image.outputName) {
      return;
    }

    const link = document.createElement('a');
    link.href = image.outputUrl;
    link.download = image.outputName;
    link.click();
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  trackById(_index: number, image: ImageItem): number {
    return image.id;
  }

  private addImages(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const rejectedCount = files.length - imageFiles.length;
    const remainingSlots = this.maxImages - this.images.length;
    const acceptedFiles = imageFiles.slice(0, Math.max(remainingSlots, 0));
    const overflowCount = imageFiles.length - acceptedFiles.length;

    this.images = [
      ...this.images,
      ...acceptedFiles.map((file) => ({
        id: this.nextId++,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'ready' as ImageStatus,
      })),
    ];

    if (rejectedCount || overflowCount) {
      const messages: string[] = [];
      if (rejectedCount) {
        messages.push(`${rejectedCount} non-image file${rejectedCount === 1 ? '' : 's'} skipped`);
      }
      if (overflowCount) {
        messages.push(`the ${this.maxImages}-image limit was reached`);
      }
      this.setNotice(`${messages.join('; ')}.`, true);
      return;
    }

    if (acceptedFiles.length) {
      this.notice = `${acceptedFiles.length} image${acceptedFiles.length === 1 ? '' : 's'} added.`;
      this.noticeIsError = false;
    }
  }

  private async renderImage(item: ImageItem): Promise<string> {
    const source = await this.loadImage(item.previewUrl);
    const overlay = this.overlayPreviewUrl
      ? await this.loadImage(this.overlayPreviewUrl)
      : undefined;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Your browser could not create an image canvas.');
    }

    context.drawImage(source, 0, 0);
    const [vertical, horizontal] = this.placement.split('-');
    const hasWatermarkText = !!this.watermarkText.trim();
    const metrics = this.getWatermarkMetrics(
      source.naturalWidth,
      source.naturalHeight,
      overlay?.naturalWidth,
      overlay?.naturalHeight
    );
    const marginX = source.naturalWidth * 0.035;
    const marginY = source.naturalHeight * 0.035;
    context.font = `600 ${metrics.fontSize}px system-ui, sans-serif`;
    const textWidth = hasWatermarkText
      ? Math.min(
          context.measureText(this.watermarkText.trim()).width,
          metrics.maxWidth - metrics.overlayWidth - metrics.gap
        )
      : 0;
    const textHeight = hasWatermarkText ? metrics.fontSize * 1.2 : 0;
    const groupWidth = overlay
      ? metrics.overlayWidth + (textWidth ? metrics.gap : 0) + textWidth
      : textWidth;
    const groupHeight = Math.max(metrics.overlayHeight, textHeight);
    const x = this.getPosition(
      horizontal,
      source.naturalWidth - groupWidth,
      marginX
    );
    const y = this.getPosition(
      vertical,
      source.naturalHeight - groupHeight,
      marginY
    );
    context.globalAlpha = this.overlayOpacity / 100;
    context.filter = this.watermarkFilter;
    if (overlay) {
      const overlayY = y + (groupHeight - metrics.overlayHeight) / 2;
      context.drawImage(
        overlay,
        x,
        overlayY,
        metrics.overlayWidth,
        metrics.overlayHeight
      );
    }
    context.filter = 'none';

    if (textWidth) {
      context.fillStyle = this.watermarkColor;
      context.textAlign = overlay || horizontal === 'left'
        ? 'left'
        : horizontal === 'right'
          ? 'right'
          : 'center';
      context.textBaseline = 'middle';
      const textX = overlay
        ? x + metrics.overlayWidth + metrics.gap
        : horizontal === 'left'
          ? x
          : horizontal === 'right'
            ? x + groupWidth
            : x + groupWidth / 2;
      const textY = y + groupHeight / 2;
      context.filter = this.watermarkFilter;
      context.fillText(this.watermarkText.trim(), textX, textY, textWidth);
      context.filter = 'none';
    }

    context.globalAlpha = 1;

    const blob = await this.canvasToBlob(canvas);
    if (blob.type !== this.outputFormat) {
      throw new Error(`${this.formatLabel(this.outputFormat)} export is not supported by this browser.`);
    }
    return URL.createObjectURL(blob);
  }

  private getWatermarkMetrics(
    sourceWidth: number,
    sourceHeight: number,
    overlayWidth = 0,
    overlayHeight = 0
  ): WatermarkMetrics {
    const scale = this.overlayScale / 100;
    const maxWidth = sourceWidth * scale;
    const hasOverlay = overlayWidth > 0 && overlayHeight > 0;
    const hasText = !!this.watermarkText.trim();
    const gap = hasOverlay && hasText
      ? Math.min(
          Math.min(sourceWidth, sourceHeight) * scale * 0.38 * 0.35,
          maxWidth * 0.08
        )
      : 0;
    const overlayMaxWidth = hasOverlay && hasText
      ? (maxWidth - gap) * 0.55
      : maxWidth;
    let renderedOverlayWidth = 0;
    let renderedOverlayHeight = 0;

    if (hasOverlay) {
      const overlayScale = Math.min(
        overlayMaxWidth / overlayWidth,
        (sourceHeight * scale) / overlayHeight
      );
      renderedOverlayWidth = overlayWidth * overlayScale;
      renderedOverlayHeight = overlayHeight * overlayScale;
    }

    const fontSize = Math.max(
      12,
      Math.min(
        240,
        Math.min(sourceWidth, sourceHeight) * scale * 0.38
      )
    );

    return {
      maxWidth,
      gap,
      overlayWidth: renderedOverlayWidth,
      overlayHeight: renderedOverlayHeight,
      fontSize,
    };
  }

  private getPosition(alignment: string, available: number, margin: number): number {
    if (alignment === 'left' || alignment === 'top') {
      return margin;
    }
    if (alignment === 'right' || alignment === 'bottom') {
      return available - margin;
    }
    return available / 2;
  }

  private loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('An image could not be opened.'));
      image.src = source;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('The browser could not export this image.'));
          }
        },
        this.outputFormat,
        this.outputQuality / 100
      );
    });
  }

  private createOutputName(fileName: string): string {
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const extension = this.outputFormat.split('/')[1].replace('jpeg', 'jpg');
    return `${baseName}-overlay.${extension}`;
  }

  private formatLabel(format: OutputFormat): string {
    return this.formats.find((item) => item.value === format)?.label ?? 'Image';
  }

  private setNotice(message: string, isError: boolean): void {
    this.notice = message;
    this.noticeIsError = isError;
  }

  private releaseImageUrls(): void {
    for (const image of this.images) {
      URL.revokeObjectURL(image.previewUrl);
      if (image.outputUrl) {
        URL.revokeObjectURL(image.outputUrl);
      }
    }
  }

  private releaseOverlayUrl(): void {
    if (this.overlayPreviewUrl) {
      URL.revokeObjectURL(this.overlayPreviewUrl);
    }
    this.overlayFile = undefined;
    this.overlayPreviewUrl = '';
  }
}
