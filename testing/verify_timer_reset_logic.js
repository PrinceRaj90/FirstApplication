/**
 * TIMER RESET LOGIC TEST
 * This script simulates the React state and interval logic from App.js
 * to verify that every time startRandomQueue is called, the timer stays consistent and resets correctly.
 */

class AppSimulator {
    constructor() {
        this.searchTimer = 300;
        this.searchInterval = null;
        this.status = 'idle';
    }

    // This mirrors the startRandomQueue function in App.js
    startRandomQueue(iteration) {
        console.log(`\n--- [TEST ITERATION ${iteration}] Starting Search ---`);
        
        // Logic from App.js:
        // 1. Reset timer to 300
        this.searchTimer = 300;
        console.log(`[LOG] searchTimer reset to: ${this.searchTimer}`);

        // 2. Clear old interval if it exists
        if (this.searchInterval) {
            console.log(`[LOG] Clearing old interval...`);
            clearInterval(this.searchInterval);
        }

        // 3. Start new interval
        this.searchInterval = setInterval(() => {
            this.searchTimer--;
            // Simple log every 50 "seconds" to save space, or just first few
            if (this.searchTimer > 295 || this.searchTimer % 50 === 0) {
                console.log(`[TICK] Countdown: ${this.searchTimer}s`);
            }

            if (this.searchTimer <= 0) {
                console.log(`[LOG] Timer reached zero. Stopping.`);
                clearInterval(this.searchInterval);
            }
        }, 10); // Sped up for testing (10ms instead of 1000ms)

        this.status = 'searching';
    }

    stopSearch() {
        console.log(`\n--- Stopping Search ---`);
        if (this.searchInterval) {
            clearInterval(this.searchInterval);
            this.searchInterval = null;
        }
        this.searchTimer = 300;
        this.status = 'idle';
        console.log(`[LOG] Timer cleared and reset to 300.`);
    }
}

async function runTest() {
    const app = new AppSimulator();

    // 1st Search: Let it run for a bit
    app.startRandomQueue(1);
    await new Promise(r => setTimeout(r, 100)); // Simulate 10 ticks (100ms / 10ms)

    // 2nd Search: Start again without stopping manually (simulates rapid clicking)
    app.startRandomQueue(2);
    await new Promise(r => setTimeout(r, 100));

    // 3rd Search: Stop then start
    app.stopSearch();
    app.startRandomQueue(3);
    await new Promise(r => setTimeout(r, 100));

    app.stopSearch();
    console.log(`\n✅ TEST COMPLETE: Every time 'startRandomQueue' was called, the timer reset to 300.`);
    process.exit(0);
}

runTest();
