"use client";

import { clamp } from "@/lib/animation";

export function applyHeroScrollToDocument(
  scroll: number,
  heroSection: HTMLElement,
  titleEl: HTMLDivElement | null,
) {
  const min = window.innerHeight;
  const max = heroSection.offsetHeight;

  if (scroll < window.innerHeight) {
    document.body.classList.add("hide-logo");
  } else {
    document.body.classList.remove("hide-logo");
  }

  if (scroll > min && scroll < max) {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }

  if (titleEl) {
    titleEl.setAttribute(
      "data-scrolled",
      scroll > window.innerHeight ? "true" : "false",
    );
  }
}

export function clearHeroScrollBodyClasses() {
  if (typeof window === "undefined") return;
  document.body.classList.remove("light");
  document.body.classList.remove("hide-logo");
}

export function applyHeroParallaxFrame(
  imageEl: HTMLDivElement | null,
  logoEl: HTMLDivElement | null,
  titleEl: HTMLDivElement | null,
  overlayEl: HTMLDivElement | null,
) {
  if (typeof window === "undefined") return;

  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const progress = clamp(window.scrollY / wh, 0, 1);

  if (imageEl) {
    const imgBaseWidth = imageEl.offsetWidth;
    const imgTargetScale = imgBaseWidth > 0 ? ww / imgBaseWidth : 1;
    const scale = 1 + (imgTargetScale - 1) * progress;
    imageEl.style.transform = `scale(${scale}) translate3d(0, 0, 0)`;
  }

  if (logoEl) {
    const logoTargetHeight = 24;
    const logoTargetOffset = Math.max(wh - logoTargetHeight - 48, 0);
    const logoBaseHeight = logoEl.offsetHeight;
    const logoTargetScale =
      logoBaseHeight > 0 ? logoTargetHeight / logoBaseHeight : 1;
    const scale = 1 + (logoTargetScale - 1) * progress;
    const y = logoTargetOffset * progress;
    logoEl.style.transformOrigin = "center bottom";
    logoEl.style.transform = `translate3d(-50%, ${-y}px, 0) scale(${scale})`;
  }

  if (overlayEl) {
    overlayEl.style.opacity = progress.toString();
  }

  if (titleEl) {
    const titleY = 16 * (1 - progress);
    titleEl.style.transform = `translate3d(0, ${titleY}px, 0)`;
    titleEl.style.setProperty('--title-opacity', `${1 - progress}`);
  }
}


import {
  Money,
  parseGid,
  useProduct,
} from "@shopify/hydrogen-react";
import type { ProductVariant } from "@shopify/hydrogen-react/storefront-api-types";
import { useLenis } from "lenis/react";
import { motion } from "motion/react";
import { type RefObject, useCallback } from "react";
import type { HomePageType, ImageType, ProductType } from "@/sanity.types";
import { ProductLink } from "../product-link";
import { Button, Image, Logo, LogoStacked, RichText, ShopImage } from "../ui";
import { HOME_HERO_EDITORIAL_MIN_HEIGHT, HOME_HERO_EDITORIAL_MIN_HEIGHT_WIDE } from "./home-hero-desktop-constants";

type UseProductReturn = ReturnType<
  typeof import("@shopify/hydrogen-react").useProduct
>;

type HeroContent = HomePageType["hero"];

type RandomVariant = (ProductVariant & { rawImage?: ImageType | null }) | null;

export function HomeHeroDesktopLoading() {
  return (
    <motion.section
      className="w-full h-dvh bg-white"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0 }}
    />
  );
}

type StickyTitleProps = {
  titleRef: RefObject<HTMLDivElement | null>;
  product: NonNullable<UseProductReturn["product"]>;
  subtitle: string | undefined;
  selectedVariant: UseProductReturn["selectedVariant"];
};

export function HomeHeroDesktopStickyTitle({
  titleRef,
  product,
  subtitle,
  selectedVariant,
}: StickyTitleProps) {
  return (
    <div className="sticky top-0 w-full h-200 -mb-200 z-5 text-white text-body font-bold pointer-events-none flex justify-center">
      <div
        ref={titleRef}
        className="group/title w-col-12.25 wide:w-[calc((100dvh-32px)*(4/5))] wide:opacity-(--title-opacity) flex flex-col items-start py-16 px-12 transform-gpu will-change-transform"
        style={{ '--title-opacity': 1 } as React.CSSProperties}
        data-scrolled={false}
      >
        <div className="h-50 not-wide:group-data-[scrolled=true]/title:opacity-0 not-wide:group-data-[scrolled=true]/title:pointer-events-none transition-all duration-150 ease-out">
          <h1 className="sr-only">Mouthwash Magazine</h1>
          <LogoStacked className="h-31.5 w-auto" />
        </div>

        <div className="relative h-50 not-wide:group-data-[scrolled=true]/title:-translate-y-50 transition-transform duration-150 ease-out">
          <ProductLink
            className="uppercase pointer-events-auto group-data-[scrolled=false]/title:card-link"
            href={`/products/${product.handle}?variant=${parseGid(selectedVariant?.id).id}`}
          >
            {product.title}
          </ProductLink>
          <div className="grid-contain place-items-start">
            <p className="not-wide:group-data-[scrolled=true]/title:opacity-0 not-wide:group-data-[scrolled=true]/title:pointer-events-none transition-all duration-150 ease-out">
              {subtitle}
            </p>
            <ProductLink
              href={`/products/${product.handle}`}
              className="opacity-0 pointer-events-none not-wide:group-data-[scrolled=true]/title:opacity-100 not-wide:group-data-[scrolled=true]/title:translate-y-0 not-wide:group-data-[scrolled=true]/title:pointer-events-auto transition-all duration-150 ease-out"
            >
              <span className="flex gap-x-4">Buy Now {selectedVariant?.price ? <Money data={selectedVariant.price} /> : null}</span>
            </ProductLink>
          </div>
        </div>
      </div>
    </div>
  );
}

type FixedLogoProps = {
  logoRef: RefObject<HTMLDivElement | null>;
};

export function HomeHeroDesktopFixedLogo({ logoRef }: FixedLogoProps) {
  return (
    <div
      ref={logoRef}
      className="fixed bottom-28 left-1/2 z-10 text-white w-col-11.75 wide:w-[calc((100dvh-32px)*(4/5)-32px)] h-auto hidden hide-logo:block will-change-transform pointer-events-none"
    >
      <Logo className="w-full h-auto pointer-events-none" />
    </div>
  );
}

type ParallaxCoverProps = {
  imageRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  randomVariant: RandomVariant;
  mounted: boolean;
};

export function HomeHeroDesktopParallaxCover({
  imageRef,
  overlayRef,
  randomVariant,
  mounted,
}: ParallaxCoverProps) {
  const lenis = useLenis();

  const scrollToProduct = useCallback(() => {
    if (lenis && typeof window !== "undefined") {
      lenis.scrollTo(window.innerHeight + 1, { duration: 0.65, lerp: 0.08 });
    }
  }, [lenis]);

  return (
    <div className="w-full sticky -mt-200">
      <button
        type="button"
        className="absolute z-10 w-col-12.25 wide:w-auto wide:aspect-4/5 h-[calc(100svh-32px)] top-16 left-1/2 -translate-x-1/2 bg-transparent cursor-pointer"
        onClick={scrollToProduct}
        aria-label="Scroll to product"
      />

      <div className="w-full h-[200svh] relative -mb-[100svh]">
        <div className="w-full flex-center h-svh sticky top-0 z-0 bg-white">
          {randomVariant && mounted ? (
            <div
              ref={imageRef}
              className="h-[calc(100svh-32px)] w-col-12.25 wide:w-auto wide:aspect-4/5 relative overflow-hidden origin-[50%_16px]"
            >
              {randomVariant.rawImage ? (
                <Image
                  className="absolute inset-0 w-full h-full object-cover"
                  image={randomVariant.rawImage}
                  sizes="(max-width: 1000px) 100vw, 50vw"
                />
              ) : randomVariant.image ? (
                <ShopImage
                  className="absolute inset-0 w-full h-full object-cover"
                  sizes="(max-width: 1000px) 100vw, 50vw"
                  {...randomVariant.image}
                />
              ) : null}
              <div ref={overlayRef} className="absolute inset-0 w-full h-full bg-black/20 z-3" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type EditorialProps = {
  hero: HeroContent;
  viewAllHref: string | null;
  selectedVariant: UseProductReturn["selectedVariant"];
};

export function HomeHeroDesktopEditorial({
  hero,
  viewAllHref,
  selectedVariant,
}: EditorialProps) {
  const { product } = useProduct() as { product: Partial<ProductType> };

  if (!product) return null;

  return (
    <div
      className="w-full flex flex-col relative min-h-(--min-height) wide:min-h-(--min-height-wide)"
      style={{ '--min-height': HOME_HERO_EDITORIAL_MIN_HEIGHT, '--min-height-wide': HOME_HERO_EDITORIAL_MIN_HEIGHT_WIDE } as React.CSSProperties}
    >
      <div className="flex-1 site-container flex flex-col gap-y-80 justify-between relative z-1 text-white pt-[100svh]">
        <div className="w-full site-grid">
          <div className="w-full col-span-full md:col-span-18 md:col-start-7 flex flex-col gap-y-32 md:grid md:grid-cols-[8fr_10fr] relative">
            <div className="w-full flex flex-col gap-y-8 md:col-start-2 absolute bottom-full right-0 pb-32">
              <h2 className="text-subtitle">{hero.info.title}</h2>
              <div className="text-body-lg flex flex-col items-start gap-y-8">
                <RichText value={hero.info.text} />
              </div>
            </div>

            {product.contributors?.length ? (
              <>
                <h2 className="text-subtitle">{hero.contributors.title}</h2>
                <div className="text-body-lg flex flex-col items-start gap-y-8">
                  {product.contributors.map((contributor) => contributor.name).join(', ')}
                </div>
              </>
            ) : null}

            {product.featuring?.length ? (
              <>
                <h2 className="text-subtitle">{hero.featured.title}</h2>
                <div className="text-body-lg flex flex-col items-start gap-y-8">
                  {product.featuring.map((feature) => feature.name).join(', ')}

                  {viewAllHref ? (
                    <Button variant="secondary-light" asChild>
                      <ProductLink href={viewAllHref}>
                        Explore{" "}
                        <span className="uppercase ml-6">{product?.title}</span>
                      </ProductLink>
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="w-full site-grid text-body-lg py-16">
          <div className="w-full col-span-full md:col-span-18 md:col-start-7 flex flex-col md:grid md:grid-cols-[8fr_10fr]">
            <div className="w-full md:col-start-2 flex items-center justify-between">
              <ProductLink
                href={`/products/${product.handle}`}
              >
                Buy Now
              </ProductLink>

              {selectedVariant?.price ? (
                <Money data={selectedVariant.price} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
