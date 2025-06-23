import { Scene } from './scene.js';
import './styles.css';

const scene = new Scene();
scene.init();

window.addEventListener('scroll', () => {
    scene.handleScroll();
});