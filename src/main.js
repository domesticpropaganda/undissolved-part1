if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

import { Scene } from './scene.js';
import './styles/main.css';
 // Overlay update logic
    window.updateTimelineOverlay = function({ year, event, species, contaminationRate, description, show }) {
      const header = document.querySelector('.overlay-header');
      const yearEl = document.querySelector('.overlay-year');
      const stat = document.querySelector('.overlay-stat');
      const statMain = document.querySelector('.overlay-stat-main');
      const statSublabel = document.querySelector('.overlay-stat-sublabel');
      const speciesEl = document.querySelector('.overlay-species');
      const footer = document.querySelector('.overlay-footer');
      if (!header || !yearEl || !stat || !statMain || !statSublabel || !footer || !speciesEl) return;
      // Header/footer always visible
      header.textContent = 'UNDISSOLVED - SNAPSHOTS OF A SYNTHETIC AGE';
      footer.textContent = '©2025 STUDIØE';
      // Show/hide stat+year block
      if (!show) {
        yearEl.style.opacity = 0;
        stat.style.opacity = 0;
        statMain.style.opacity = 0;
        statSublabel.style.opacity = 0;
        speciesEl.style.opacity = 0;
        return;
      }
      // Set content
      yearEl.textContent = year;
      statMain.textContent = Math.round(contaminationRate * 100) + '%';
      speciesEl.textContent = species || '';
      // Highlight first part of description in pink
      let desc = description || '';
      let match = desc.match(/^(of [^,\s]+|of [^\s]+)/i);
      if (match) {
        statSublabel.innerHTML = `<span class='pink'>${match[0]}</span>` + desc.slice(match[0].length);
      } else {
        statSublabel.textContent = desc;
      }
      // Animate stat+year block in order: year, contam rate, description
      yearEl.style.opacity = 0;
      statMain.style.opacity = 0;
      statSublabel.style.opacity = 0;
      statSublabel.style.display = 'none';
      stat.style.opacity = 1; // container always visible for layout
      statMain.textContent = '00%'; // Reset stat to 00% before anim
      speciesEl.style.opacity = 0;
      setTimeout(() => {
        yearEl.style.transition = 'opacity 0.5s';
        yearEl.style.opacity = 1;
        setTimeout(() => {
          statMain.style.transition = 'opacity 0.5s';
          statMain.style.opacity = 1;
          // Start contamination percentage animation (no fade)
          let targetPercent = Math.round((contaminationRate || 0) * 100);
          let animStart = null;
          let animDuration = 1200;
          function animatePercent(ts) {
            if (!animStart) animStart = ts;
            let elapsed = ts - animStart;
            let progress = Math.min(1, elapsed / animDuration);
            let val = Math.round(targetPercent * progress);
            statMain.textContent = (val < 10 ? '0' : '') + val + '%';
            if (progress < 1) {
              requestAnimationFrame(animatePercent);
            } else {
              statMain.textContent = (targetPercent < 10 ? '0' : '') + targetPercent + '%';
              // Typewriter effect for sublabel after percent animation
              statSublabel.style.transition = '';
              statSublabel.style.display = 'block';
              statSublabel.style.opacity = 1;
              let sublabelHTML = '';
              let pinkSpan = null;
              let desc = description || '';
              let match = desc.match(/^(of [^,\s]+|of [^\s]+)/i);
              let sublabelText = '';
              if (match) {
                statSublabel.innerHTML = `<span class='pink'>${match[0]}</span>`;
                pinkSpan = statSublabel.querySelector('.pink');
                sublabelText = desc.slice(match[0].length);
                sublabelHTML = pinkSpan ? pinkSpan.outerHTML : '';
              } else {
                statSublabel.innerHTML = '';
                sublabelText = desc;
                sublabelHTML = '';
              }
              let i = 0;
              function typeWriter() {
                statSublabel.innerHTML = sublabelHTML + sublabelText.slice(0, i);
                if (i <= sublabelText.length) {
                  i++;
                  setTimeout(typeWriter, 18); // speed in ms per letter
                } else {
                  // Fade in species after typewriter completes
                  speciesEl.style.transition = 'opacity 0.5s';
                  speciesEl.style.opacity = 1;
                }
              }
              typeWriter();
            }
          }
          requestAnimationFrame(animatePercent);
        }, 400);
      }, 200);
    };
const scene = new Scene();

// No need to call handleScroll; scroll is handled internally by Scene
// window.addEventListener('scroll', () => {
//   scene.handleScroll(window.scrollY);
// });

// No need to call animate here; Scene handles it after assets load
// scene.animate();