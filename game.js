const NAME_POOL = ['Bill', 'Mary', 'Aunty Mary', 'Andy', 'Dave', 'John', 'Kurt', 'Sara', 'Therese', 'Lorraine', 'Elaine', 'Clinton', 'Joan'];
let activePlayerNames = ['South (You)', 'John', 'Andy', 'Dave']; // Will be randomized per match

const SUIT_NAMES = { H: 'Hearts ♥', D: 'Diamonds ♦', C: 'Clubs ♣', S: 'Spades ♠', N: 'No Trump' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RANK_ORDER = { '3': 3, '5': 5, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let gameState = {
  phase: 'BIDDING',
  dealerIndex: 0,
  activePlayer: 1,
  highBid: { amount: 6, suit: null, playerIndex: -1 },
  bids: [null, null, null, null],
  scores: { us: 0, them: 0 },
  tricksWon: { us: 0, them: 0 },
  handPoints: { us: 0, them: 0 },
  trumpSuit: null,
  hands: [[], [], [], []],
  currentTrick: [],
  leadSuit: null,
  isStuckDealer: false,
  // Track special cards for smarter AI decisions
  fiveHeartsPlayed: false,
  threeSpadesPlayed: false
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-start-game').addEventListener('click', startNewMatch);
  document.getElementById('btn-restart-game').addEventListener('click', startNewMatch);
  document.getElementById('btn-submit-bid').addEventListener('click', handleHumanBid);
  document.getElementById('btn-pass').addEventListener('click', handleHumanPass);
});

function createDeck() {
  const suits = ['H', 'D', 'C', 'S'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];

  suits.forEach(suit => {
    ranks.forEach(rank => {
      if ((suit === 'H' && rank === '7') || (suit === 'S' && rank === '7')) return;
      deck.push({ suit, rank });
    });
  });

  deck.push({ suit: 'S', rank: '3' }); // Low card (-3 pts)
  deck.push({ suit: 'H', rank: '5' }); // High card (+5 pts)
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function randomizePlayerNames() {
  let shuffled = [...NAME_POOL].sort(() => 0.5 - Math.random());
  activePlayerNames[1] = shuffled[0]; // West
  activePlayerNames[2] = shuffled[1]; // North (Partner)
  activePlayerNames[3] = shuffled[2]; // East

  document.querySelector('#west .player-name').textContent = activePlayerNames[1];
  document.querySelector('#north .player-name').textContent = `${activePlayerNames[2]} (Partner)`;
  document.querySelector('#east .player-name').textContent = activePlayerNames[3];
}

function dealCards() {
  const deck = shuffleDeck(createDeck());
  gameState.hands = [[], [], [], []];

  for (let i = 0; i < deck.length; i++) {
    gameState.hands[i % 4].push(deck[i]);
  }

  const suitOrder = { H: 0, D: 1, C: 2, S: 3 };

  gameState.hands[0].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}

function startNewMatch() {
  document.getElementById('welcome-modal').classList.add('hidden');
  document.getElementById('gameover-modal').classList.add('hidden');
  gameState.scores = { us: 0, them: 0 };
  gameState.dealerIndex = 0;
  randomizePlayerNames();
  startNewHand();
}

function startNewHand() {
  gameState.phase = 'BIDDING';
  gameState.highBid = { amount: 6, suit: null, playerIndex: -1 };
  gameState.bids = [null, null, null, null];
  gameState.trumpSuit = null;
  gameState.currentTrick = [];
  gameState.leadSuit = null;
  gameState.tricksWon = { us: 0, them: 0 };
  gameState.handPoints = { us: 0, them: 0 };
  gameState.isStuckDealer = false;
  gameState.fiveHeartsPlayed = false;
  gameState.threeSpadesPlayed = false;

  dealCards();
  gameState.activePlayer = (gameState.dealerIndex + 1) % 4;

  for (let i = 0; i < 4; i++) {
    const dialog = document.getElementById(`bid-dialog-${i}`);
    if (dialog) {
      dialog.textContent = '';
      dialog.classList.add('hidden');
    }
  }

  updateUI();
  checkAutoBid();
}

function checkAutoBid() {
  if (gameState.phase !== 'BIDDING') return;

  if (gameState.activePlayer === 0) {
    setupHumanBiddingUI();
  } else {
    document.getElementById('bidding-panel').classList.add('hidden');
    setTimeout(processAIBid, 600);
  }
}

function setupHumanBiddingUI() {
  const panel = document.getElementById('bidding-panel');
  const btnPass = document.getElementById('btn-pass');
  const amountSelect = document.getElementById('bid-amount');
  const header = document.getElementById('bidding-header');
  const amountLabel = document.getElementById('lbl-bid-amount');

  if (gameState.isStuckDealer) {
    header.textContent = "You are Stuck Dealer (Forced Bid 7)";
    btnPass.classList.add('hidden');
    amountSelect.classList.add('hidden');
    amountLabel.classList.add('hidden');
  } else {
    header.textContent = "Your Bid";
    btnPass.classList.remove('hidden');
    amountSelect.classList.remove('hidden');
    amountLabel.classList.remove('hidden');
  }

  panel.classList.remove('hidden');
}

/* ==========================================
   REVISED & INTELLIGENT AI BIDDING EVALUATION
   ========================================== */
function evaluateHandForBidding(pIndex) {
  const hand = gameState.hands[pIndex];
  const suits = ['H', 'D', 'C', 'S'];
  let bestSuit = 'H';
  let bestScore = -1;
  let bestEstimatedTricks = 7;

  const hasFiveHearts = hand.some(c => c.suit === 'H' && c.rank === '5');
  const hasThreeSpades = hand.some(c => c.suit === 'S' && c.rank === '3');

  // Evaluate No Trump Potential
  let highCards = hand.filter(c => RANK_ORDER[c.rank] >= 13).length; // Kings, Aces
  let secondaryCards = hand.filter(c => RANK_ORDER[c.rank] === 12 || RANK_ORDER[c.rank] === 11).length; // Queens, Jacks
  let noTrumpScore = highCards * 1.5 + secondaryCards * 0.8 + (hasFiveHearts ? 2.0 : 0) - (hasThreeSpades ? 1.0 : 0);

  if (noTrumpScore >= 8.5) {
    return { suit: 'N', estimatedTricks: Math.min(12, Math.max(7, Math.floor(noTrumpScore + 1))) };
  }

  // Evaluate Suit Contracts
  suits.forEach(suit => {
    const suitCards = hand.filter(c => c.suit === suit);
    const trumpLength = suitCards.length;
    
    // Count high trumps (A, K, Q, J, 10)
    const highTrumps = suitCards.filter(c => RANK_ORDER[c.rank] >= 10).length;
    
    // Count outside Aces/Kings for side suit strength
    const sideAcesAndKings = hand.filter(c => c.suit !== suit && (c.rank === 'A' || c.rank === 'K')).length;

    // 3-Spot specific card value adjustments
    let bonus = 0;
    if (suit === 'H' && hasFiveHearts) bonus += 2.5;
    if (suit === 'S' && hasThreeSpades) bonus -= 1.5; // 3 of Spades is a liability (-3 pts)

    let estTricks = (trumpLength * 0.7) + (highTrumps * 1.2) + (sideAcesAndKings * 0.9) + bonus;

    if (estTricks > bestScore) {
      bestScore = estTricks;
      bestSuit = suit;
      bestEstimatedTricks = Math.round(estTricks);
    }
  });

  return { 
    suit: bestSuit, 
    estimatedTricks: Math.min(12, Math.max(7, bestEstimatedTricks)) 
  };
}

function processAIBid() {
  const pIndex = gameState.activePlayer;

  if (gameState.isStuckDealer) {
    const evalResult = evaluateHandForBidding(pIndex);
    recordBid(pIndex, 7, evalResult.suit);
    advanceBidding();
    return;
  }

  const evalResult = evaluateHandForBidding(pIndex);
  const minRequiredBid = gameState.highBid.amount + 1;

  if (evalResult.estimatedTricks >= minRequiredBid && minRequiredBid <= 12) {
    recordBid(pIndex, minRequiredBid, evalResult.suit);
  } else {
    recordBid(pIndex, 0, 'PASS');
  }

  advanceBidding();
}

function handleHumanBid() {
  const suit = document.getElementById('bid-suit').value;

  if (gameState.isStuckDealer) {
    recordBid(0, 7, suit);
  } else {
    const amount = parseInt(document.getElementById('bid-amount').value, 10);
    if (amount <= gameState.highBid.amount) {
      alert(`Bid must be higher than ${gameState.highBid.amount}`);
      return;
    }
    recordBid(0, amount, suit);
  }

  document.getElementById('bidding-panel').classList.add('hidden');
  advanceBidding();
}

function handleHumanPass() {
  recordBid(0, 0, 'PASS');
  document.getElementById('bidding-panel').classList.add('hidden');
  advanceBidding();
}

function recordBid(playerIndex, amount, suit) {
  const dialog = document.getElementById(`bid-dialog-${playerIndex}`);

  if (suit === 'PASS' || amount === 0) {
    gameState.bids[playerIndex] = 'Pass';
    if (dialog) dialog.textContent = 'Pass';
  } else {
    gameState.highBid = { amount, suit, playerIndex };
    const label = `${amount} ${SUIT_NAMES[suit] || suit}`;
    gameState.bids[playerIndex] = label;
    if (dialog) dialog.textContent = label;
  }

  if (dialog) dialog.classList.remove('hidden');
}

function advanceBidding() {
  const totalBids = gameState.bids.filter(b => b !== null).length;

  if (totalBids < 4) {
    gameState.activePlayer = (gameState.activePlayer + 1) % 4;
    checkAutoBid();
    return;
  }

  const allPassed = gameState.bids.every(b => b === 'Pass');
  if (allPassed && !gameState.isStuckDealer) {
    gameState.isStuckDealer = true;
    gameState.activePlayer = gameState.dealerIndex;
    gameState.bids[gameState.dealerIndex] = null;
    checkAutoBid();
    return;
  }

  finishBidding();
}

function finishBidding() {
  gameState.phase = 'PLAYING';
  if (gameState.highBid.playerIndex !== -1) {
    gameState.trumpSuit = gameState.highBid.suit;
    document.getElementById('trump-suit').textContent = SUIT_NAMES[gameState.trumpSuit] || 'None';
    gameState.activePlayer = gameState.highBid.playerIndex;
  } else {
    document.getElementById('trump-suit').textContent = 'No Bid';
    gameState.activePlayer = (gameState.dealerIndex + 1) % 4;
  }

  updateUI();
  processPlayTurn();
}

function processPlayTurn() {
  if (gameState.phase !== 'PLAYING') return;

  if (gameState.activePlayer !== 0) {
    setTimeout(playAICard, 700);
  }
}

function isCardBoss(card) {
  let maxRankValue = RANK_ORDER[card.rank];
  for (let i = 0; i < 4; i++) {
    gameState.hands[i].forEach(c => {
      if (c.suit === card.suit && RANK_ORDER[c.rank] > maxRankValue) {
        maxRankValue = RANK_ORDER[c.rank];
      }
    });
  }
  return RANK_ORDER[card.rank] === maxRankValue;
}

/* ==========================================
   IMPROVED AI CARD PLAY LOGIC
   Focus: 5♥ (capture or dump to partner) and 3♠ (stick opponents)
   ========================================== */
function playAICard() {
  const pIndex = gameState.activePlayer;
  const hand = gameState.hands[pIndex];
  if (!hand || hand.length === 0) return;

  // Determine legal cards (must follow suit if possible)
  let legalCards = hand;
  if (gameState.leadSuit) {
    const matching = hand.filter(c => c.suit === gameState.leadSuit);
    if (matching.length > 0) legalCards = matching;
  }

  const partnerIndex = (pIndex + 2) % 4;
  const fiveHearts = legalCards.find(c => c.suit === 'H' && c.rank === '5');
  const threeSpades = legalCards.find(c => c.suit === 'S' && c.rank === '3');

  const currentWinner = getCurrentTrickWinner();
  const isPartnerWinning = currentWinner && currentWinner.playerIndex === partnerIndex;
  const isOpponentWinning = currentWinner && currentWinner.playerIndex !== partnerIndex;

  // Helper: lowest card that is neither special
  function lowestNonSpecial(cards) {
    const nonSpecial = cards.filter(c => !(c.suit === 'H' && c.rank === '5') && !(c.suit === 'S' && c.rank === '3'));
    if (nonSpecial.length === 0) return null;
    nonSpecial.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    return nonSpecial[0];
  }

  // Helper: lowest card overall
  function lowestCard(cards) {
    const sorted = [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    return sorted[0];
  }

  // Helper: cards that currently beat the best card in the trick
  function getWinningCards(cards) {
    if (!currentWinner) return cards; // leading – any card "wins" for now
    return cards.filter(c => beatsCurrentBest(c, currentWinner.card));
  }

  let chosenCard = null;

  // ========== CASE 1: Leading the trick ==========
  if (gameState.currentTrick.length === 0) {
    // Prefer Aces (especially if boss), then high cards, avoid specials
    const aces = legalCards.filter(c => c.rank === 'A');
    if (aces.length > 0) {
      // Prefer Ace of trump if available, otherwise any Ace
      const trumpAce = aces.find(c => c.suit === gameState.trumpSuit);
      chosenCard = trumpAce || aces[0];
    } else {
      // Prefer a high non-special card
      const highNonSpecial = legalCards
        .filter(c => !(c.suit === 'H' && c.rank === '5') && !(c.suit === 'S' && c.rank === '3') && RANK_ORDER[c.rank] >= 12)
        .sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
      if (highNonSpecial.length > 0) {
        chosenCard = highNonSpecial[0];
      } else {
        // Fallback to any non-special, then anything
        chosenCard = lowestNonSpecial(legalCards) || legalCards[0];
      }
    }
  }

  // ========== CASE 2: Partner is currently winning ==========
  else if (isPartnerWinning) {
    // Best action: dump the 5♥ onto partner
    if (fiveHearts) {
      chosenCard = fiveHearts;
    }
    // Never dump 3♠ on partner
    else if (threeSpades) {
      chosenCard = lowestNonSpecial(legalCards) || threeSpades;
    }
    // Otherwise play lowest non-winning / low card
    else {
      chosenCard = lowestCard(legalCards);
    }
  }

  // ========== CASE 3: We can win the trick ourselves ==========
  else if (getWinningCards(legalCards).length > 0) {
    const winningCards = getWinningCards(legalCards);

    // If 5♥ is a winning card, take it (capture the +5)
    if (fiveHearts && winningCards.includes(fiveHearts)) {
      chosenCard = fiveHearts;
    } else {
      // Take the cheapest (lowest rank) winning card
      winningCards.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
      chosenCard = winningCards[0];
    }
  }

  // ========== CASE 4: Opponent is winning and we cannot beat it ==========
  else if (isOpponentWinning) {
    // Stick them with the 3♠ if we have it
    if (threeSpades) {
      chosenCard = threeSpades;
    }
    // Do NOT give them the 5♥ unless forced
    else if (fiveHearts) {
      chosenCard = lowestNonSpecial(legalCards) || fiveHearts;
    }
    // Otherwise dump lowest
    else {
      chosenCard = lowestCard(legalCards);
    }
  }

  // ========== CASE 5: Fallback (should rarely hit) ==========
  else {
    // Prefer non-specials
    chosenCard = lowestNonSpecial(legalCards) || legalCards[0];
  }

  // Safety net
  if (!chosenCard) chosenCard = legalCards[0];

  playCard(pIndex, chosenCard);
}

function getCurrentTrickWinner() {
  if (gameState.currentTrick.length === 0) return null;
  let winnerObj = gameState.currentTrick[0];

  for (let i = 1; i < gameState.currentTrick.length; i++) {
    const play = gameState.currentTrick[i];
    if (beatsCurrentBest(play.card, winnerObj.card)) {
      winnerObj = play;
    }
  }
  return winnerObj;
}

function beatsCurrentBest(cardCandidate, bestCard) {
  if (!bestCard) return true; // leading

  // Trump beats non-trump
  if (cardCandidate.suit === gameState.trumpSuit && bestCard.suit !== gameState.trumpSuit) {
    return true;
  }
  // Same suit – higher rank wins
  if (cardCandidate.suit === bestCard.suit) {
    return RANK_ORDER[cardCandidate.rank] > RANK_ORDER[bestCard.rank];
  }
  return false;
}

function handleHumanCardClick(cardIndex) {
  if (gameState.phase !== 'PLAYING' || gameState.activePlayer !== 0) return;

  const hand = gameState.hands[0];
  const chosenCard = hand[cardIndex];

  if (gameState.leadSuit && chosenCard.suit !== gameState.leadSuit) {
    const hasLeadSuit = hand.some(c => c.suit === gameState.leadSuit);
    if (hasLeadSuit) {
      alert(`You must follow suit (${SUIT_NAMES[gameState.leadSuit]})!`);
      return;
    }
  }

  playCard(0, chosenCard);
}

function playCard(playerIndex, card) {
  const hand = gameState.hands[playerIndex];
  const cardIdx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIdx !== -1) hand.splice(cardIdx, 1);

  // Track specials
  if (card.suit === 'H' && card.rank === '5') gameState.fiveHeartsPlayed = true;
  if (card.suit === 'S' && card.rank === '3') gameState.threeSpadesPlayed = true;

  if (gameState.currentTrick.length === 0) {
    gameState.leadSuit = card.suit;
  }

  gameState.currentTrick.push({ card, playerIndex });
  updateUI();

  if (gameState.currentTrick.length === 4) {
    setTimeout(resolveTrick, 1200);
  } else {
    gameState.activePlayer = (gameState.activePlayer + 1) % 4;
    processPlayTurn();
  }
}

function resolveTrick() {
  let winnerObj = getCurrentTrickWinner();
  const winnerTeam = (winnerObj.playerIndex === 0 || winnerObj.playerIndex === 2) ? 'us' : 'them';
  
  gameState.tricksWon[winnerTeam]++;

  let trickPoints = 1;
  gameState.currentTrick.forEach(play => {
    if (play.card.suit === 'H' && play.card.rank === '5') trickPoints += 5;
    if (play.card.suit === 'S' && play.card.rank === '3') trickPoints -= 3;
  });

  gameState.handPoints[winnerTeam] += trickPoints;

  gameState.activePlayer = winnerObj.playerIndex;
  gameState.currentTrick = [];
  gameState.leadSuit = null;

  updateUI();

  if (gameState.hands[0].length === 0) {
    evaluateHandScore();
  } else {
    processPlayTurn();
  }
}

function evaluateHandScore() {
  const biddingTeam = (gameState.highBid.playerIndex === 0 || gameState.highBid.playerIndex === 2) ? 'us' : 'them';
  const defenderTeam = biddingTeam === 'us' ? 'them' : 'us';
  const bidAmount = gameState.highBid.amount;
  const isNoTrump = (gameState.trumpSuit === 'N');

  let handResultMsg = isNoTrump ? `Hand Complete (NO TRUMP CONTRACT)!\n\n` : `Hand Complete!\n\n`;

  if (isNoTrump) {
    if (gameState.handPoints[biddingTeam] >= bidAmount) {
      const gained = gameState.handPoints[biddingTeam] * 2;
      gameState.scores[biddingTeam] += gained;
      handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) made No Trump bid of ${bidAmount} (raw pts: ${gameState.handPoints[biddingTeam]}) and scored double: +${gained} points.\n`;
    } else {
      const penalty = bidAmount * 2;
      gameState.scores[biddingTeam] -= penalty;
      handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) failed No Trump bid of ${bidAmount}. Penalty: -${penalty} points.\n`;
    }

    const defenderGained = gameState.handPoints[defenderTeam] * 2;
    gameState.scores[defenderTeam] += defenderGained;
    handResultMsg += `Defenders (${defenderTeam.toUpperCase()}) scored double raw points: +${defenderGained} points.`;
  } else {
    if (gameState.handPoints[biddingTeam] >= bidAmount) {
      const gained = gameState.handPoints[biddingTeam];
      gameState.scores[biddingTeam] += gained;
      handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) made their bid of ${bidAmount} (took ${gameState.handPoints[biddingTeam]} pts) and scored +${gained} points.\n`;
    } else {
      const penalty = bidAmount;
      gameState.scores[biddingTeam] -= penalty;
      handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) set! Failed bid of ${bidAmount}. Lost -${penalty} points.\n`;
    }

    const defenderGained = gameState.handPoints[defenderTeam];
    gameState.scores[defenderTeam] += defenderGained;
    handResultMsg += `Defenders (${defenderTeam.toUpperCase()}) scored +${defenderGained} points.`;
  }

  alert(handResultMsg);

  if (checkMatchEnding()) return;

  gameState.dealerIndex = (gameState.dealerIndex + 1) % 4;
  startNewHand();
}

function checkMatchEnding() {
  const us = gameState.scores.us;
  const them = gameState.scores.them;
  let gameOver = false;
  let title = "";
  let msg = "";
  let isLoss = false;

  if (us >= 52) {
    title = "Congratulations! You Won!";
    msg = `Your team reached ${us} points!`;
    gameOver = true;
  } else if (them >= 52) {
    title = "Game Over - Opponents Won";
    msg = `Opponents reached ${them} points.`;
    gameOver = true;
    isLoss = true;
  } else if (us <= -52) {
    title = "Game Over - Defeat";
    msg = `Your team dropped to ${us} points (-52 threshold reached).`;
    gameOver = true;
    isLoss = true;
  } else if (them <= -52) {
    title = "Victory!";
    msg = `Opponents dropped to ${them} points (-52 threshold reached).`;
    gameOver = true;
  }

  if (gameOver) {
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-message').textContent = msg;

    const broomstickBox = document.getElementById('broomstick-box');
    if (broomstickBox) {
      if (isLoss) {
        broomstickBox.classList.remove('hidden');
      } else {
        broomstickBox.classList.add('hidden');
      }
    }

    document.getElementById('gameover-modal').classList.remove('hidden');
    return true;
  }
  return false;
}

function updateUI() {
  const dealerBadge = document.getElementById('dealer-indicator');
  if (dealerBadge) {
    dealerBadge.className = `dealer-${gameState.dealerIndex}`;
  }

  document.querySelector('#west .player-name').textContent = activePlayerNames[1];
  document.querySelector('#north .player-name').textContent = `${activePlayerNames[2]} (Partner)`;
  document.querySelector('#east .player-name').textContent = activePlayerNames[3];

  const dirs = ['south', 'west', 'north', 'east'];
  dirs.forEach((dir) => {
    const cardContainer = document.querySelector(`#${dir} .cards-container`);
    if (cardContainer) cardContainer.innerHTML = '';
  });

  const southContainer = document.querySelector('#south .cards-container');
  if (southContainer && gameState.hands[0]) {
    gameState.hands[0].forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.suit === 'H' || card.suit === 'D' ? 'red' : 'black'}`;
      cardEl.textContent = `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
      cardEl.style.cursor = 'pointer';
      cardEl.addEventListener('click', () => handleHumanCardClick(index));
      southContainer.appendChild(cardEl);
    });
  }

  [1, 2, 3].forEach(playerIdx => {
    const dir = dirs[playerIdx];
    const container = document.querySelector(`#${dir} .cards-container`);
    if (container && gameState.hands[playerIdx]) {
      gameState.hands[playerIdx].forEach(() => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card back';
        cardEl.textContent = '🂠';
        container.appendChild(cardEl);
      });
    }
  });

  const trickArea = document.getElementById('trick-area');
  if (trickArea) {
    trickArea.innerHTML = '';
    gameState.currentTrick.forEach(play => {
      const cardEl = document.createElement('div');
      cardEl.className = `card trick-card played-${play.playerIndex} ${play.card.suit === 'H' || play.card.suit === 'D' ? 'red' : 'black'}`;
      cardEl.textContent = `${play.card.rank}${SUIT_SYMBOLS[play.card.suit]}`;
      trickArea.appendChild(cardEl);
    });
  }

  document.getElementById('score-us').textContent = gameState.scores.us;
  document.getElementById('score-them').textContent = gameState.scores.them;
  document.getElementById('tricks-us-count').textContent = gameState.tricksWon.us;
  document.getElementById('tricks-them-count').textContent = gameState.tricksWon.them;
}