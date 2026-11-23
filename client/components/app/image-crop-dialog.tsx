'use client';

import { useEffect, useRef, useState } from 'react';
import { IconPhoto, IconZoomIn } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type ImageKind = 'avatar' | 'banner';
type CropDialogProps = {
  kind: ImageKind;
  file: File | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => Promise<void>;
};

export function ImageCropDialog({
  kind,
  file,
  open,
  pending,
  onOpenChange,
  onSave,
}: CropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const banner = kind === 'banner';
  const maxSize = banner ? 5 * 1024 * 1024 : 1024 * 1024;
  const canvasWidth = banner ? 900 : 512;
  const canvasHeight = banner ? 300 : 512;

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const nextImage = new window.Image();
    nextImage.onload = () => {
      if (nextImage.naturalWidth * nextImage.naturalHeight > 20_000_000) {
        setError(
          'This image is larger than 20 megapixels. Choose a smaller image.',
        );
        return;
      }
      setImage(nextImage);
    };
    nextImage.onerror = () =>
      setError(
        'This image could not be opened. Choose a JPEG, PNG, or WebP image.',
      );
    nextImage.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !image) return;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = '#111111';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    const scale =
      Math.max(
        canvasWidth / image.naturalWidth,
        canvasHeight / image.naturalHeight,
      ) * zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const overflowX = Math.max(0, drawWidth - canvasWidth);
    const overflowY = Math.max(0, drawHeight - canvasHeight);
    context.drawImage(
      image,
      (canvasWidth - drawWidth) / 2 + (offset.x * overflowX) / 2,
      (canvasHeight - drawHeight) / 2 + (offset.y * overflowY) / 2,
      drawWidth,
      drawHeight,
    );
  }, [image, zoom, offset, canvasWidth, canvasHeight]);

  function moveCrop(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || !image) return;
    const canvas = event.currentTarget;
    const scale =
      Math.max(
        canvasWidth / image.naturalWidth,
        canvasHeight / image.naturalHeight,
      ) * zoom;
    const overflowX = Math.max(1, image.naturalWidth * scale - canvasWidth);
    const overflowY = Math.max(1, image.naturalHeight * scale - canvasHeight);
    setOffset({
      x: Math.max(
        -1,
        Math.min(
          1,
          drag.offsetX +
            ((((event.clientX - drag.x) * canvasWidth) / canvas.clientWidth) *
              2) /
              overflowX,
        ),
      ),
      y: Math.max(
        -1,
        Math.min(
          1,
          drag.offsetY +
            ((((event.clientY - drag.y) * canvasHeight) / canvas.clientHeight) *
              2) /
              overflowY,
        ),
      ),
    });
  }

  async function saveCrop() {
    if (!image || !file) return;
    setError('');
    const width = banner ? 1500 : 256;
    const height = banner ? 500 : 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Unable to prepare this image. Please try again.');
      return;
    }
    const scale =
      Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(
      image,
      (width - drawWidth) / 2 + (offset.x * Math.max(0, drawWidth - width)) / 2,
      (height - drawHeight) / 2 +
        (offset.y * Math.max(0, drawHeight - height)) / 2,
      drawWidth,
      drawHeight,
    );
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError('Unable to prepare this image. Please try again.');
          return;
        }
        if (blob.size > maxSize) {
          setError(
            `The cropped image must be under ${banner ? '5 MiB' : '1 MiB'}.`,
          );
          return;
        }
        try {
          await onSave(
            new File([blob], `${kind}.webp`, { type: 'image/webp' }),
          );
        } catch (saveError) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : 'Unable to upload this image. Please try again.',
          );
        }
      },
      'image/webp',
      0.9,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <div className="pr-10">
          <DialogTitle>{banner ? 'Edit banner' : 'Change avatar'}</DialogTitle>
          <DialogDescription className="mt-1">
            Drag the image to adjust the crop, or use the controls below.
          </DialogDescription>
        </div>
        {image ? (
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            role="group"
            aria-label="Image crop preview"
            aria-describedby="crop-help"
            tabIndex={0}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.12 : 0.04;
              if (event.key === 'ArrowLeft')
                setOffset((value) => ({
                  ...value,
                  x: Math.max(-1, value.x - step),
                }));
              else if (event.key === 'ArrowRight')
                setOffset((value) => ({
                  ...value,
                  x: Math.min(1, value.x + step),
                }));
              else if (event.key === 'ArrowUp')
                setOffset((value) => ({
                  ...value,
                  y: Math.max(-1, value.y - step),
                }));
              else if (event.key === 'ArrowDown')
                setOffset((value) => ({
                  ...value,
                  y: Math.min(1, value.y + step),
                }));
              else return;
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                x: event.clientX,
                y: event.clientY,
                offsetX: offset.x,
                offsetY: offset.y,
              };
            }}
            onPointerMove={moveCrop}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            className={`w-full touch-none border border-border bg-black focus-visible:outline-2 focus-visible:outline-ring ${banner ? 'aspect-[3/1]' : 'mx-auto aspect-square max-w-sm'}`}
          />
        ) : (
          <div className="flex aspect-[3/1] items-center justify-center bg-muted text-muted-foreground">
            <IconPhoto aria-hidden="true" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="crop-zoom" className="flex items-center gap-2">
            <IconZoomIn size={16} aria-hidden="true" /> Zoom
          </Label>
          <input
            id="crop-zoom"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={!image || pending}
            className="w-full accent-primary"
          />
        </div>
        <p id="crop-help" className="text-xs text-muted-foreground">
          Use the arrow keys while the preview is focused to move the image.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="min-h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              try {
                saveCrop();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : 'Unable to prepare this image. Please try again.',
                );
              }
            }}
            disabled={!image || pending}
            className="min-h-11"
          >
            {pending ? 'Saving…' : 'Save image'}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
