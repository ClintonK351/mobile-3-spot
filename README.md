# 3-Spot (Nault Family Version)

A web-based, 32-card trick-taking card game built with Vanilla JavaScript, HTML, and CSS, featuring custom family rules, smart heuristic AI opponents, and mobile responsiveness. Hosted live via GitHub Pages.

## Features

* **Responsive Design:** Optimized for seamless play across desktop computers, tablets, and mobile phones (iOS and Android).
* **Randomized AI Opponents:** Computer seats are dynamically assigned unique names from the family/friend pool (`Bill`, `Mary`, `Aunty Mary`, `Andy`, `Dave`, `John`, `Kurt`, `Sara`, `Therese`, `Lorraine`, `Elaine`, `Clinton`, `Joan`) at the start of every match.
* **Special Card Values:** 
  * **5 of Hearts ($\boldsymbol{5\flat}$):** High-value card worth **+5 points**.
  * **3 of Spades ($\boldsymbol{3\spadesuit}$):** Low-value penalty card worth **–3 points**.
* **Custom Bidding & Scoring Rules:**
  * Standard suit contracts score raw points taken (or bid penalty if failed).
  * **No-Trump Contracts:** High-stakes bidding where success doubles the bidding team's raw points ($2 \times \text{raw points}$), failure applies a double-bid penalty ($-2 \times \text{bid}$), and defenders score double their raw points. AI players exercise strict caution before bidding No-Trump.
  * **Stuck Dealer Rule:** If all players pass, the dealer is forced to bid 7 and can choose a trump suit or No-Trump.
* **Match Target:** The first team to reach **52 points** wins the match; dropping to **–52 points** results in defeat.
* **Family Joke Easter Egg:** When the human player loses a match, Andy chimes in via a custom dialog box with the classic family quote: *"What a broom stick.... tsk.... tsk"*.

## Files Included

* `index.html` — The main game layout, welcome overlay, game-over modal, scoreboard, and bidding controls.
* `style.css` — Responsive styling, card layouts, animations, and mobile media queries.
* `game.js` — Core game engine, deck generation, randomized AI names, heuristic bidding/playing intelligence, trick resolution, and scoring logic.

## Running Locally

1. Clone or download this repository.
2. Ensure `index.html`, `style.css`, and `game.js` are in the same folder.
3. Open `index.html` in any modern web browser (Firefox, Chrome, Safari, etc.) or deploy directly to **GitHub Pages**.[cite: 9, 11]
