/** Shown when a blocked site or app comes to the front (US-013). */
export function BlockNotice({intention}: {intention: string}) {
    return (
        <main className="block-notice">
            <p className="block-intention">{intention}</p>
            <p className="block-affirmation">That's still true.</p>
        </main>
    );
}
