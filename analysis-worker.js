// Run the engine off the UI thread so navigation remains responsive.
importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.1/chess.min.js', 'script.js');
self.onmessage = event => {
    try {
        self.postMessage(calculateReview(event.data.fen, event.data.moves));
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};
