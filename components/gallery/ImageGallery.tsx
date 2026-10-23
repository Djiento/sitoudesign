"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

export type GalleryImage = {
  src: string;
  alt: string;
};

type ImageGalleryProps = {
  images: GalleryImage[];
  locale: "fr" | "en";
  className?: string;
  itemClassName?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  thumbnails?: boolean;
  displayCount?: number;
};

function ExpandableImage({
  src,
  alt,
  className,
  loadingLabel,
  errorLabel,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loadingLabel: string;
  errorLabel: string;
  loading?: "eager" | "lazy";
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {!loaded && !failed && (
        <span className="image-gallery-loading" aria-hidden="true">
          <LoaderCircle size={22} className="image-gallery-spinner" />
          <span className="image-gallery-visually-hidden">{loadingLabel}</span>
        </span>
      )}
      {failed ? (
        <span className="image-gallery-error" role="status">
          {errorLabel}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={className}
          loading={loading}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

export default function ImageGallery({
  images,
  locale,
  className = "",
  itemClassName = "",
  imageClassName = "",
  loading = "lazy",
  thumbnails = true,
  displayCount,
}: ImageGalleryProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  if (images.length === 0) return null;

  const activeImage = images[activeIndex] ?? images[0];
  const text = locale === "fr"
    ? {
        open: (alt: string) => `Agrandir l’image : ${alt}`,
        close: "Fermer la visionneuse",
        previous: "Image précédente",
        next: "Image suivante",
        loading: "Chargement de l’image",
        error: "Impossible d’afficher cette image.",
        position: (index: number) => `Image ${index + 1} sur ${images.length}`,
      }
    : {
        open: (alt: string) => `Enlarge image: ${alt}`,
        close: "Close image viewer",
        previous: "Previous image",
        next: "Next image",
        loading: "Loading image",
        error: "This image could not be displayed.",
        position: (index: number) => `Image ${index + 1} of ${images.length}`,
      };

  const showImage = (index: number) => {
    setActiveIndex((index + images.length) % images.length);
  };
  const visibleImages = images.slice(0, displayCount ?? images.length);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className={`image-gallery ${className}`.trim()}>
        {visibleImages.map((image, index) => (
          <figure className={`image-gallery-item ${itemClassName}`.trim()} key={`${image.src}-${index}`}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="image-gallery-trigger"
                aria-label={text.open(image.alt || text.position(index))}
                onClick={() => setActiveIndex(index)}
              >
                <ExpandableImage
                  src={image.src}
                  alt={image.alt}
                  className={imageClassName}
                  loadingLabel={text.loading}
                  errorLabel={text.error}
                  loading={loading}
                />
                <span className="image-gallery-zoom-hint" aria-hidden="true">+</span>
              </button>
            </Dialog.Trigger>
          </figure>
        ))}
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="image-lightbox-overlay" />
        <Dialog.Content
          className="image-lightbox"
          aria-describedby="image-lightbox-position"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" && images.length > 1) {
              event.preventDefault();
              showImage(activeIndex + 1);
            } else if (event.key === "ArrowLeft" && images.length > 1) {
              event.preventDefault();
              showImage(activeIndex - 1);
            }
          }}
          onPointerDown={(event) => setTouchStart(event.clientX)}
          onPointerUp={(event) => {
            if (touchStart === null || images.length < 2) return;
            const distance = event.clientX - touchStart;
            if (Math.abs(distance) > 55) {
              showImage(activeIndex + (distance < 0 ? 1 : -1));
            }
            setTouchStart(null);
          }}
        >
          <Dialog.Title className="image-lightbox-visually-hidden">
            {activeImage.alt || (locale === "fr" ? "Agrandissement de l’image" : "Enlarged image")}
          </Dialog.Title>
          <Dialog.Description
            id="image-lightbox-position"
            className="image-lightbox-visually-hidden"
          >
            {text.position(activeIndex)}
          </Dialog.Description>

          <Dialog.Close asChild>
            <button type="button" className="image-lightbox-close" aria-label={text.close}>
              <X size={22} />
            </button>
          </Dialog.Close>

          {images.length > 1 && (
            <button
              type="button"
              className="image-lightbox-arrow image-lightbox-previous"
              aria-label={text.previous}
              onClick={() => showImage(activeIndex - 1)}
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <div className="image-lightbox-stage">
            <ExpandableImage
              key={activeImage.src}
              src={activeImage.src}
              alt={activeImage.alt}
              className="image-lightbox-image"
              loadingLabel={text.loading}
              errorLabel={text.error}
              loading="eager"
            />
            {images.length > 1 && (
              <span className="image-lightbox-count" aria-live="polite">
                {activeIndex + 1} / {images.length}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <button
              type="button"
              className="image-lightbox-arrow image-lightbox-next"
              aria-label={text.next}
              onClick={() => showImage(activeIndex + 1)}
            >
              <ChevronRight size={28} />
            </button>
          )}

          {thumbnails && images.length > 1 && (
            <div className="image-lightbox-thumbnails" aria-label={locale === "fr" ? "Miniatures de la galerie" : "Gallery thumbnails"}>
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image.src}-thumbnail-${index}`}
                  className={`image-lightbox-thumbnail${index === activeIndex ? " is-active" : ""}`}
                  aria-label={text.position(index)}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => showImage(index)}
                >
                  <ExpandableImage
                    src={image.src}
                    alt=""
                    loadingLabel={text.loading}
                    errorLabel={text.error}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
