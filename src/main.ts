import { Game } from './core/Game';

const container = document.getElementById('app');

if (!(container instanceof HTMLElement)) {
  throw new Error('#app container not found');
}

const game = new Game(container);
game.start();
