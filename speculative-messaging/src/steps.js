// Narration for each step. `id` doubles as the timeline label in main.js.
// The scene shows *what* changes; the panel explains *why*.
//
// One pass through the round trip. The channel handshake is told compactly; the
// first data block (block N+2) then shows every mechanism in detail on its way to B.
// Follows speculative messaging design v0.6 and the Parachain Service design.

const S0 = 'Introduction'
const S1 = 'Opening the channel'
const S2 = 'A sends block N+2'
const S3 = 'Block N+2 settles on JAM'
const S4 = 'B fetches the messages'
const S5 = 'B consumes them in block M+2'
const S6 = 'Block M+2 settles'
const S7 = 'The confirmation reaches A'

// Labels of the chapter buttons in the panel.
export const chips = { [S0]: '★', [S1]: '1', [S2]: '2', [S3]: '3', [S4]: '4', [S5]: '5', [S6]: '6', [S7]: '7' }

export const steps = [
	// ── Introduction ──
	{
		id: 'goal',
		stage: S0,
		title: 'Messages between two parachains',
		body: `
			<p><strong>Goal:</strong> parachain A sends messages to parachain B.</p>
			<ul>
				<li>Messages travel over a <strong>channel</strong> from A to B. Channels are one-way: for
				replies, B would open its own channel to A.</li>
				<li>B only consumes messages whose root JAM has already accepted. The design calls this the
				<strong>inclusion tier</strong>; faster tiers exist but are not shown here.</li>
			</ul>`,
	},
	{
		id: 'why',
		stage: S0,
		title: 'Why: only hashes on chain',
		body: `
			<ul>
				<li>Today, with HRMP, every message passes through the relay chain: it is stored in
				relay chain state and processed by its runtime. Every byte sent costs relay chain
				space and execution.</li>
				<li>The new design moves the messages off-chain: collators exchange them directly.
				On chain, each parachain only publishes a 32-byte root per block that commits to its
				messages, and the receiving block is checked against it. In this walkthrough, JAM's
				Parachain Service plays the role of the relay chain.</li>
			</ul>`,
	},
	{
		id: 'intro',
		stage: S0,
		title: 'The cast',
		body: `
			<ul>
				<li><strong>Parachain runtimes A and B</strong> keep only compact state: a few hashes per
				message stream and the channel state. A channel is a pair of streams: <em>data</em> (A
				writes, B reads) and <em>ack</em> (B writes, A reads).</li>
				<li><strong>Collator nodes</strong> build blocks as today. They keep the actual messages
				on local disk and exchange them directly. The tab on each runtime shows its current
				block: amber while it is built or on its way through JAM, green once JAM accepted it.</li>
				<li><strong>JAM's Parachain Service</strong> takes over from the relay chain. Refine plays
				the role of backing (runs the validation code on the PoV), Accumulate the role of
				inclusion (enacts the candidate). Per parachain it keeps a small <em>settlement ring</em>
				of recent roots.</li>
			</ul>`,
	},
	// ── Opening the channel ──
	{
		id: 'ov-accept',
		stage: S1,
		title: 'B accepts the channel',
		body: `
			<ul>
				<li>A wants a channel to B (its runtime called <code>open()</code>, which writes nothing yet).
				On B, someone submits <code>accept_open_channel(A, …)</code>; B's policy decides who may.
				B's collator includes it in block M.</li>
				<li>B records the channel and appends a <code>Register</code> to its ack stream:
				<em>Accepting</em> session 1, with the versions and the maximum message size B supports.
				<code>up_to 0</code>: B has consumed nothing yet.</li>
				<li>B's streams changed, so block M commits a new root, T<sub>B1</sub>. B's collator archives the
				register.</li>
				<li>Block M goes through JAM and T<sub>B1</sub> is stored in B's settlement ring. Both steps are
				shown in detail later, with A's first data block.</li>
			</ul>`,
	},
	{
		id: 'ov-hello',
		stage: S1,
		title: 'A answers with Hello',
		body: `
			<ul>
				<li>A's collator watches B's ring on JAM. It changed: B's newest root is T<sub>B1</sub>.</li>
				<li>It asks B's collators for the newest register of the channel (a <code>MessagesRequest</code>
				for the stream's head) and checks it against T<sub>B1</sub> with a Merkle proof.</li>
				<li>In block N, the messaging inherent brings the register. A applies it and answers with
				<code>Hello</code> (session 1, a version from B's range) as message #0 of its data stream.
				A writes nothing to the channel before this point. <code>Hello</code> counts as in flight:
				1 of 16, A's own limit.</li>
				<li>Block N's streams changed, so it commits root T<sub>A1</sub>. A's collator archives
				<code>Hello</code>.</li>
				<li>Block N read B's register, so JAM accepts it only if T<sub>B1</sub> is in B's ring. It is.
				T<sub>A1</sub> is stored in A's ring. This check is shown in detail for B's block M+2.</li>
			</ul>`,
	},
	{
		id: 'ov-opened',
		stage: S1,
		title: 'B consumes Hello: the channel is open',
		body: `
			<ul>
				<li>B's collator sees T<sub>A1</sub> in A's ring and fetches A's data stream from #0, proven
				against T<sub>A1</sub>: <code>Hello</code>.</li>
				<li>In block M+1, B consumes <code>Hello</code> and the channel is <em>Opened</em>. The
				messaging pallet handles <code>Hello</code> itself; it never reaches B's application.</li>
				<li>At the end of every block in which it changed, B publishes its register: now
				<code>up_to 1</code>, Opened. B's streams changed, so block M+1 commits root T<sub>B2</sub>.</li>
				<li>Block M+1 consumed from A, so JAM accepts it only if T<sub>A1</sub> is in A's ring. It is.
				T<sub>B2</sub> is stored in B's ring.</li>
			</ul>`,
	},
	{
		id: 'ov-read',
		stage: S1,
		title: 'A reads Opened and may send',
		body: `
			<ul>
				<li>A's collator sees T<sub>B2</sub> in B's ring and fetches the newest register, checked
				against T<sub>B2</sub>.</li>
				<li>Block N+1 applies it: the channel is open for data. B has consumed <code>Hello</code>
				(<code>up_to 1</code>), so nothing is in flight: 0 of 16.</li>
				<li>Block N+1 changed no stream, so it has no root of its own. JAM still checks its dependency:
				T<sub>B2</sub> is in B's ring.</li>
			</ul>`,
	},
	// ── A sends block N+2 ──
	{
		id: 's1-intro',
		stage: S2,
		title: "A's collator starts block N+2",
		body: `
			<ul>
				<li>A's collator starts block N+2. The dependency on T<sub>B2</sub> belonged to block N+1; every
				block declares its own.</li>
				<li>In flight is everything A sent that B has not yet confirmed: nothing so far. The limit, 16
				messages, is A's own configuration (<code>MaxInFlight</code>), not something B grants.</li>
			</ul>`,
	},
	{
		id: 's1-send',
		stage: S2,
		title: 'Two sends, each gated by the in-flight limit',
		body: `
			<ul>
				<li>The app calls <code>send(B, data)</code>. The runtime checks the in-flight limit and B's
				maximum message size, then appends the message to this block's outbox
				(<code>OutboundMessages</code>).</li>
				<li>Each stream is a Merkle Mountain Range (MMR), an append-only Merkle structure. The runtime
				stores only its frontier, a few peak hashes, never the messages themselves.</li>
				<li>The new messages take the next positions, #1 and #2. During the block, the stored frontier
				still covers only #0, the <code>Hello</code>.</li>
			</ul>`,
	},
	{
		id: 's1-bag',
		stage: S2,
		title: 'Block end: bag the data stream',
		body: `
			<ul>
				<li>At the end of the block, the runtime adds #1 and #2 to the frontier in memory: #1 merges
				with #0 into a peak, #2 starts a new one.</li>
				<li>The stream's root hashes the leaf count together with the bagged peaks, so a proof cannot
				claim a different number of messages. It is never stored; it is always recomputed from the
				frontier.</li>
			</ul>`,
	},
	{
		id: 's1-fold',
		stage: S2,
		title: 'Fold all streams into one root',
		body: `
			<ul>
				<li>A's <code>StreamsRoot</code> is the root of a small Merkle trie over all its streams, keyed
				by stream id. Only the paths of changed streams are recomputed.</li>
				<li>The new root T<sub>A2</sub> (A's second root: only blocks that change a stream publish one)
				is the single hash A publishes for block N+2. It goes into the block
				header, and during validation it is handed to JAM (host function 204).</li>
				<li>A block that changes no stream publishes no root.</li>
			</ul>`,
	},
	{
		id: 's1-outputs',
		stage: S2,
		title: 'What leaves the block',
		body: `
			<ul>
				<li>T<sub>A2</sub> is in A's block header, where other chains' collators can check against it.</li>
				<li>A's collator copies the block's messages, #1 and #2, into its archive. The archive is
				local disk, not chain state.</li>
				<li>At the start of block N+3, the runtime folds #1 and #2 into the stored frontier.</li>
			</ul>`,
	},
	// ── Block N+2 settles on JAM ──
	{
		id: 's2-package',
		stage: S3,
		title: 'A work package for block N+2',
		body: `
			<ul>
				<li>A's collator wraps block N+2 and its PoV into a work package for the Parachain Service.</li>
				<li>Guarantors on A's core pick it up and run Refine.</li>
			</ul>`,
	},
	{
		id: 's2-refine',
		stage: S3,
		title: 'Refine re-executes block N+2',
		body: `
			<ul>
				<li>Refine is the backing step: it runs A's validation code on the PoV, re-executing block N+2.</li>
				<li>The validation code reports its results through host functions. Function 204 declares
				T<sub>A2</sub>, the same root block N+2 put into its header.</li>
				<li>Function 205 declares dependencies on other chains. Block N+2 read nothing from other chains,
				so it is not called.</li>
			</ul>`,
	},
	{
		id: 's2-join',
		stage: S3,
		title: 'Guaranteed and available',
		body: `
			<ul>
				<li>JAM validators guarantee the result (the work report), and the package's data is made
				available.</li>
				<li>Only then does JAM pass the result to the Parachain Service's Accumulate.</li>
			</ul>`,
	},
	{
		id: 's2-accumulate',
		stage: S3,
		title: 'Accumulate checks, then enacts',
		body: `
			<ul>
				<li>Accumulate is the inclusion step, the counterpart of <code>enact_candidate</code>. It runs a
				fixed list of checks.</li>
				<li>Checks 1–4: block N+2 must build on A's current head and use A's current code.</li>
				<li>Check 5 is the messaging check. Block N+2 depends on no other chain, so it passes
				trivially; B's block M+2 is checked here for real.</li>
			</ul>`,
	},
	{
		id: 's2-enact',
		stage: S3,
		title: "T<sub>A2</sub> lands in A's ring",
		body: `
			<ul>
				<li>Accumulate updates A's head and stores T<sub>A2</sub> in A's settlement ring.</li>
				<li>The ring keeps A's 64 newest distinct roots; the oldest drops out when a new one arrives.
				Any block of another chain may now depend on T<sub>A2</sub>, as long as it stays in the
				ring.</li>
			</ul>`,
	},
	// ── B fetches the messages ──
	{
		id: 's3-notice',
		stage: S4,
		title: "B's collator sees T<sub>A2</sub> in A's ring",
		body: `
			<ul>
				<li>B's collator watches A's ring and sees the new root T<sub>A2</sub>.</li>
				<li>B's runtime tells it which streams B reads, and from which position: A's data stream, from
				#1. B consumed <code>Hello</code> in block M+1.</li>
				<li>B builds on T<sub>A2</sub> because it is already settled on JAM: B's block cannot fail because
				of A.</li>
			</ul>`,
	},
	{
		id: 's3-fetch',
		stage: S4,
		title: "B asks A's collator for the messages",
		body: `
			<ul>
				<li>B's collator asks A's collators for A's data stream from #1, proven against T<sub>A2</sub>
				(a <code>MessagesRequest</code>).</li>
				<li>A's collator answers from its archive: m<sub>1</sub> and m<sub>2</sub>, plus the proofs
				that tie them to T<sub>A2</sub>.</li>
				<li>Messages are addressed by stream and position, not by block: B does not need to know which
				of A's blocks wrote them.</li>
			</ul>
			<p class="key"><strong>The key split.</strong> On-chain, the Parachain Service only
			stores 32-byte roots, one per block that sent messages. The messages and the proofs that tie them
			to a root travel collator to collator, off-chain. That keeps JAM's work small.</p>`,
	},
	{
		id: 's3-verify',
		stage: S4,
		title: 'B checks the response',
		body: `
			<ul>
				<li>B's collator hashes the messages and appends them to its frontier for A's stream, which
				holds <code>Hello</code>. Order and count need no separate check: anything else would give a
				different root.</li>
				<li>The proofs then lead from that stream root to A's <code>StreamsRoot</code>. B is caught
				up, so the trie proof alone is enough.</li>
				<li>The result equals T<sub>A2</sub>, which B read from JAM itself. The response is authentic.</li>
			</ul>`,
	},
	// ── B consumes them ──
	{
		id: 's4-inherent',
		stage: S5,
		title: "B's collator starts block M+2",
		body: `
			<ul>
				<li>B's collator starts block M+2 and puts the verified messages into its messaging inherent, as
				it did with <code>Hello</code>.</li>
				<li>The inherent carries only the messages, no root and no proofs. Binding them to T<sub>A2</sub>
				happens later, during validation.</li>
			</ul>`,
	},
	{
		id: 's4-consume',
		stage: S5,
		title: 'B consumes #1 and #2',
		body: `
			<ul>
				<li>B's runtime hashes each message and appends it to its frontier for A's stream: 1 → 3
				messages. That is its only proof check; it also applies the channel rules (Opened, size,
				version).</li>
				<li>m<sub>1</sub> and m<sub>2</sub> are enqueued in B's message queue, which delivers them to
				B's application. The inherent never executes them.</li>
				<li>The block records what it consumed: A's data stream, positions 1 to 3.</li>
			</ul>`,
	},
	{
		id: 's4-register',
		stage: S5,
		title: 'Block end: B confirms in the same block',
		body: `
			<ul>
				<li>B's register changed, so block M+2 publishes it at its end: <code>up_to 3</code>, Opened.
				Everything before #3 is consumed.</li>
				<li>B's streams changed, so block M+2 commits a new root, T<sub>B3</sub>; B's collator archives
				the register.</li>
				<li>There is no batching: B publishes in every block in which its register changed.</li>
			</ul>`,
	},
	{
		id: 's5-package',
		stage: S5,
		title: 'Block M+2 goes to JAM, with a lift',
		body: `
			<ul>
				<li>B's collator wraps block M+2 into a work package, as A did.</li>
				<li>The PoV also carries a <em>lift</em>: a proof that what B consumed from A's stream is
				contained in a root of A that JAM knows. Here it is a single trie proof, about 300 bytes.</li>
			</ul>`,
	},
	{
		id: 's5-refine',
		stage: S5,
		title: 'Validation turns consumption into a dependency',
		body: `
			<ul>
				<li>After re-executing block M+2, B's validation code reads the consumption record and checks
				the lift: A's stream, consumed up to 3 messages, leads to A's <code>StreamsRoot</code>
				T<sub>A2</sub>.</li>
				<li>It declares the dependency with host function 205: <code>[(A, T<sub>A2</sub>)]</code>.
				Function 204 declares B's own new root, T<sub>B3</sub>.</li>
				<li>The Parachain Service only checks the form of that list. Proving the lift is the job of
				B's own validation code, like everything else in the block.</li>
			</ul>`,
	},
	// ── Block M+1 settles ──
	{
		id: 's5-settle',
		stage: S6,
		title: "Check 5: is T<sub>A2</sub> in A's ring?",
		body: `
			<ul>
				<li>Accumulate looks up (A, T<sub>A2</sub>) in A's settlement ring. It is there, so block M+2 is
				accepted: B's head moves to M+2 and T<sub>B3</sub> is stored in B's ring.</li>
				<li>Had it been missing, B's block would be dropped without any log entry, together with all
				its upward messages.</li>
				<li>Only roots already in the ring count: B's block can never depend on a root of A that JAM
				has not settled yet.</li>
			</ul>`,
	},
	// ── The confirmation reaches A ──
	{
		id: 'ov-credit',
		stage: S7,
		title: 'A applies the confirmation',
		body: `
			<ul>
				<li>A's collator sees T<sub>B3</sub> in B's ring and fetches the newest register, checked
				against T<sub>B3</sub>.</li>
				<li>A's next block, N+3, applies it: messages before #3 are confirmed, so nothing is in flight
				any more, and JAM accepts the block because T<sub>B3</sub> is in B's ring.</li>
				<li>Once B's block M+2 is final, A's collator may delete #0–#2 from its archive: B confirmed
				them, and that can no longer be reverted.</li>
			</ul>`,
	},
	{
		id: 'summary',
		stage: S7,
		title: 'The whole picture',
		body: `
			<ul>
				<li>B accepted, A answered with <code>Hello</code>, B opened the channel. Then A sent
				m<sub>1</sub> and m<sub>2</sub>, B consumed them and confirmed in the same block, and A's
				in-flight count dropped back to 0.</li>
				<li>Registers took the same path as messages, the other way: fetched and checked off-chain,
				consumed through an inherent, and settled against the sender's ring.</li>
				<li>JAM stored a few 32-byte roots and checked each block's dependencies. All messages and
				proofs stayed with the two chains.</li>
			</ul>`,
	},
]
