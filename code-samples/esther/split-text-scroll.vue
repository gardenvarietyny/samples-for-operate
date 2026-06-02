<template>
  <div ref="sectionRef" class="sanity-poetry-section">
    <h2 class="sanity-poetry-section__title">{{ title }}</h2>

    <div class="sanity-poetry-section__content-container">
      <p ref="contentRef" aria-hidden="true" class="sanity-poetry-section__content"></p>

      <p ref="contentProxyRef" class="sanity-poetry-section__content-proxy">
        {{ stegaClean(body) }}
      </p>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { gsap } from 'gsap';
import { lerp } from '~/libs/common/math';
import { stegaClean } from '@sanity/client/stega';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const props = defineProps<{
  title: string;
  body: string;
}>();

const { title, body } = toRefs(props);

const sectionRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const contentProxyRef = ref<HTMLElement | null>(null);
const splitTextRef = ref<SplitText | null>(null);
const shouldAnimate = ref(false);

const allLines = ref<Element[]>([]);

const currentProximityValues = ref<Map<Element, number>>(new Map());
const LERP_FACTOR = 0.08;

const animateText = () => {
  const screenCenter = (window.innerHeight - 75) / 2;
  const viewportHeight = window.innerHeight;
  const cullMargin = viewportHeight * 0.5;
  const maxDistance = viewportHeight / 4;
  
  const updates: { spacer: HTMLElement; value: number }[] = [];
  
  for (const line of allLines.value) {
    const rect = line.getBoundingClientRect();
    
    if (rect.bottom < -cullMargin || rect.top > viewportHeight + cullMargin) {
      continue;
    }
    
    const distance = Math.abs(rect.y - screenCenter);
    const normalizedDistance = Math.min(1, distance / maxDistance);
    const easedValue = Math.cos(normalizedDistance * Math.PI / 2);
    const targetValue = easedValue * (window.innerWidth * 0.2);
    
    const currentValue = currentProximityValues.value.get(line) ?? targetValue;
    const lerpedValue = lerp(currentValue, targetValue, LERP_FACTOR);
    
    const spacer = (line as HTMLElement).querySelector('.sanity-poetry-section__line-spacer') as HTMLElement;
    if (spacer) {
      currentProximityValues.value.set(line, lerpedValue);
      updates.push({ spacer, value: lerpedValue });
    }
  }
  
  for (const { spacer, value } of updates) {
    spacer.style.setProperty('--spacer-width', `${value}px`);
  }
}

useFrame(() => {
  if (!shouldAnimate.value || !allLines.value?.length) return;

  if (window.innerWidth < 800) return;

  animateText();
})

const observer = ref<any>(null);

onMounted(async () => {
  await nextTick();

  if (window.innerWidth < 800) return;

  splitTextRef.value = SplitText.create(contentProxyRef.value, {
    type: 'lines, words',
    linesClass: "sanity-poetry-section__line",
    autoSplit: true,

    onSplit: () => {
      shouldAnimate.value = false;
      
      if (!contentRef.value) return;

      const lines = splitTextRef.value?.lines;

      contentRef.value.innerHTML = '';

      const paragraphLeft = document.createElement('span');
      const paragraphRight = document.createElement('span');

      paragraphLeft.classList.add('sanity-poetry-section__paragraph-left');
      paragraphRight.classList.add('sanity-poetry-section__paragraph-right');

      if (lines) {
        const lineGroups = lines.reduce((acc, line, index) => {
        if (index % 2 === 0) {
          acc.push([line, lines[index + 1] || null]);
        }
        return acc;
        }, [] as (Element | null)[][]);

        lineGroups?.forEach((group) => {
          if (!contentRef.value) return;

          const [left, right] = group;

          const lineContainer = document.createElement('div');
          lineContainer.classList.add('sanity-poetry-section__line-container');
          contentRef.value.appendChild(lineContainer);

          if (left) {
            const clone = left.cloneNode(true) as HTMLElement;
            const spacer = document.createElement('div');
            
            spacer.classList.add('sanity-poetry-section__line-spacer');
            clone.classList.add('sanity-poetry-section__line--left');
            lineContainer.appendChild(clone);
            lineContainer.appendChild(spacer);
          }

          if (right) {
            const clone = right.cloneNode(true) as HTMLElement;
            
            clone.classList.add('sanity-poetry-section__line--right');
            lineContainer.appendChild(clone);
          }
        })

        shouldAnimate.value = true;
        allLines.value = Array.from(contentRef.value?.querySelectorAll('.sanity-poetry-section__line-container') || []).map((line) => line as HTMLElement);
      }
    }
  });

  observer.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        shouldAnimate.value = true;
      } else {
        shouldAnimate.value = false;
        currentProximityValues.value.clear();
      }
    })
  }, {
    threshold: 0.1
  })

  if (sectionRef.value) {
    observer.value?.observe(sectionRef.value);
  }
})

onBeforeUnmount(() => {
  observer.value?.disconnect();
})
</script>

<style lang="scss" scoped>
.sanity-poetry-section {
  width: 100%;
  padding: var(--layout-margin);
  display: flex;
  flex-direction: column;
  row-gap: var(--spacer-32);
  padding-bottom: 50px;
  position: relative;

  @include mobile {
    padding-bottom: 96px;
  }

  :deep(.sanity-poetry-section__line) { 
    display: inline-flex !important;
    justify-content: space-between;
    width: 100%;
  }

  :deep(.sanity-poetry-section__line-container) {
    --spacer-width: 0.3em;
  }

  :deep(.sanity-poetry-section__line-spacer) {
    width: clamp(0.3em, var(--spacer-width), 100vw);
    will-change: width;
  }

  &__content-container {
    position: relative;
  }

  &__content-proxy {
    position: absolute;
    width: 45%;
    top: 0;
    left: 0;
    pointer-events: none;
    visibility: hidden;

    @include mobile {
      position: relative;
      width: 100%;
      pointer-events: auto;
      visibility: visible;
    }

    @include p;

    @include desktop {
      @include p-xl;
    }
  }

  &__title {
    @include p-accent;

    @include mobile {
      display: none;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;

    @include mobile {
      display: none;
    }

    :deep(.sanity-poetry-section__line-container) {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
    }

    @include p;

    @include desktop {
      @include p-xl;
    }
  }
}
</style>