import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the image studio', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Brand your batch');
    expect(fixture.nativeElement.textContent).toContain('Your batch');
    expect(
      fixture.nativeElement.querySelector('.app-footer a').getAttribute('href')
    ).toBe('https://abhayvishnoi.in');
  });

  it('should show settings, batch management, and preview as three sections', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const sections = Array.from(
      fixture.nativeElement.querySelector('.editor-layout').children
    ) as HTMLElement[];

    expect(sections.map((section) => section.classList[0])).toEqual([
      'controls-panel',
      'queue-panel',
      'live-preview-panel',
    ]);
    expect(sections[2].querySelector('.preview-stage')).toBeTruthy();
  });

  it('should require source images and an overlay before processing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    expect(component.canProcess).toBe(false);
    expect(component.isLossyFormat).toBe(false);

    component.outputFormat = 'image/webp';
    expect(component.isLossyFormat).toBe(true);
  });

  it('should allow a text-only watermark without a logo image', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.images = [{
      id: 1,
      file: new File(['photo'], 'campaign.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:campaign',
      status: 'ready',
    }];

    expect(component.canProcess).toBe(false);

    component.watermarkText = 'Studio North';

    expect(component.hasWatermark).toBe(true);
    expect(component.canProcess).toBe(true);
  });

  it('should preview the first queued image with the selected brand treatment', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first-photo')
      .mockReturnValueOnce('blob:second-photo');
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const input = {
      files: [
        new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
        new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
      ],
      value: 'selected',
    };

    component.selectedImagesChanged({ target: input } as unknown as Event);
    component.watermarkText = 'Northstar Studio';
    component.watermarkColor = '#ffcc44';
    component.watermarkFilter = 'sepia(0.85)';
    component.placement = 'top-right';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.live-preview-source').getAttribute('src'))
      .toBe('blob:first-photo');
    expect(fixture.nativeElement.querySelector('.preview-watermark-text').textContent.trim())
      .toBe('Northstar Studio');
    expect(fixture.nativeElement.querySelector('.watermark-layer').classList)
      .toContain('preview-placement-top-right');
    expect(component.canProcess).toBe(true);
  });

  it('should format byte sizes for the queue summary', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;

    expect(component.formatBytes(720)).toBe('720 B');
    expect(component.formatBytes(1536)).toBe('1.5 KB');
    expect(component.formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('should queue selected images and release their previews when removed', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:source-preview')
      .mockReturnValueOnce('blob:overlay-preview');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL');
    const component = TestBed.createComponent(AppComponent).componentInstance;
    const source = new File(['source'], 'photo.png', { type: 'image/png' });
    const overlay = new File(['overlay'], 'mark.png', { type: 'image/png' });
    const sourceInput = { files: [source], value: 'selected' };
    const overlayInput = { files: [overlay], value: 'selected' };

    component.selectedImagesChanged({ target: sourceInput } as unknown as Event);
    component.selectedOverlayChanged({ target: overlayInput } as unknown as Event);

    expect(component.images.length).toBe(1);
    expect(component.canProcess).toBe(true);
    expect(sourceInput.value).toBe('');

    component.removeImage(component.images[0].id);

    expect(component.images.length).toBe(0);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:source-preview');
  });

  it('should clear the image batch and release every preview and output URL', () => {
    vi.spyOn(URL, 'revokeObjectURL');
    const component = TestBed.createComponent(AppComponent).componentInstance;
    const first = {
      id: 1,
      file: new File(['one'], 'one.png', { type: 'image/png' }),
      previewUrl: 'blob:one',
      outputUrl: 'blob:one-output',
      status: 'done' as const,
    };
    const second = {
      id: 2,
      file: new File(['two'], 'two.png', { type: 'image/png' }),
      previewUrl: 'blob:two',
      status: 'ready' as const,
    };
    component.images = [first, second];
    component.progress = 100;
    component.notice = 'Done';

    component.clearImages();

    expect(component.images).toHaveLength(0);
    expect(component.progress).toBe(0);
    expect(component.notice).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one-output');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two');
  });

  it('should use a stable id when tracking queued image cards', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    const image = {
      id: 17,
      file: new File(['image'], 'photo.png', { type: 'image/png' }),
      previewUrl: 'blob:preview',
      status: 'ready' as const,
    };

    expect(component.trackById(0, image)).toBe(17);
  });

  it('should render nine selectable overlay positions', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const points = fixture.nativeElement.querySelectorAll('[role="radio"]');

    expect(points).toHaveLength(9);
    expect(points[8].getAttribute('aria-label')).toBe('Bottom right');
    expect(points[8].getAttribute('aria-checked')).toBe('true');

    points[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.placement).toBe('top-left');
    expect(points[0].getAttribute('aria-checked')).toBe('true');
  });

  it('should navigate the overlay position points with arrow keys', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const selectedPoint = fixture.nativeElement.querySelector(
      '[role="radio"][aria-checked="true"]'
    ) as HTMLButtonElement;

    selectedPoint.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.placement).toBe('bottom-center');
    expect(
      fixture.nativeElement.querySelector('[role="radio"][aria-checked="true"]')
        .getAttribute('aria-label')
    ).toBe('Bottom center');
  });

  it('should toggle the studio color theme', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isDarkMode).toBe(true);
    expect(fixture.nativeElement.querySelector('.app-shell').classList).toContain('theme-dark');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light mode');
  });
});
