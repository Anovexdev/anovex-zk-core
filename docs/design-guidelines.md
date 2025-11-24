# Anovex DEX Trading Platform - Design Guidelines

## Design Philosophy
**Premium Stealth Trading Interface**: Dark, high-contrast composition with glassmorphism panels and purple accent glows. Emphasize clarity, data hierarchy, and confident typography. Privacy-first messaging throughout—no wallet addresses, anonymized transaction data, ZK-themed nomenclature.

## Typography Hierarchy
- **Font**: Inter (CDN: Google Fonts)
- **Display**: 48-56px bold for page headers with generous letter-spacing (0.02em)
- **Headings**: 24-32px semibold for section titles
- **Body**: 14-16px regular for data tables, forms, descriptions
- **Mono**: JetBrains Mono for transaction hashes, numerical data (amounts, prices)
- **Micro**: 12px for labels, timestamps, metadata

## Layout System

### Core Structure
**Sidebar Navigation** (fixed left, 240px wide):
- Top: Anovex monogram "A" + wordmark
- Navigation items with icons (Heroicons):
  - Dashboard, Swap, Portfolio, Explorer, Deposit
- Bottom: Settings gear icon + user status indicator ("Stealth Mode: Active")
- Glassmorphism treatment with purple tint border-right

**Main Content Area** (flex-1, max-width 1440px centered):
- Page header: Title + contextual action button (top-right)
- Content grid with responsive columns
- Consistent padding: py-8 px-12 (desktop), py-6 px-6 (mobile)

### Spacing Primitives
Use Tailwind units: **2, 4, 6, 8, 12, 16, 24, 32** for consistent rhythm
- Component gaps: gap-4 to gap-6
- Section padding: py-8 to py-12
- Card padding: p-6 to p-8

## Page-Specific Layouts

### Dashboard
**Top Row** (2-column grid, gap-6):
- Left: "Total Balance" card (large display number, 7-day sparkline chart)
- Right: "Stealth Score" card (circular progress indicator, privacy metrics)

**Middle Row** (3-column grid):
- Quick stats cards: 24h Volume, Active Trades, ZK Proofs Generated

**Bottom Section**:
- "Recent Trades" table (5 rows, expandable)
- Columns: Asset Pair, Type (Buy/Sell badge), Amount, Status (ZK icon), Time
- No wallet addresses—use anonymized IDs like "Trade #A7F2E1"

### Swap Interface
**Centered Card** (max-width 480px):
- Top input: "You Pay" amount field + token selector dropdown
- Swap direction icon (animated rotate on click)
- Bottom input: "You Receive" (read-only calculated)
- Route visualization: Small node diagram showing Entry → Relay → ZK Batch → Shadow Pool
- Price impact warning banner (if >1%)
- Large CTA: "Execute Stealth Swap" button with white glow
- Below: Slippage settings, transaction speed selector

### Portfolio
**Asset Holdings Table**:
- Columns: Token (icon + symbol), Balance, USD Value, 24h Change, Actions (Swap/Send)
- Sortable headers with subtle arrow indicators
- Row hover: gentle purple glow outline

**Performance Chart** (below table):
- Line graph showing portfolio value over time (7D/30D/All toggle)
- Total PNL display with percentage badge

### Explorer
**Transaction List** (full-width table):
- Filters: Type (All/Swap/Deposit/Withdrawal), Date range picker
- Columns: TX Hash (truncated mono), Type badge, Amount, Status (ZK shield icon), Timestamp
- Hover tooltip: "Privacy-Preserved Transaction" with ZK proof indicator
- Pagination at bottom

### Deposit (ZK Relay Network)
**6-Stage Progress Bar** (top):
- Linear stepper: Select Token → Enter Amount → Generate Address → Send Crypto → Processing → Complete
- Active stage highlighted with purple glow, completed stages with checkmarks

**Main Card**:
- Stage 1-2: Token selector + amount input
- Stage 3: QR code + deposit address (copy button with glow effect)
- Stage 4-5: Animated loader with status messages ("Awaiting confirmation...", "ZK proof generating...")
- Stage 6: Success state with confetti burst, transaction summary

## Component Library

### Glassmorphism Cards
- Transparent dark base with purple tint overlay
- Thin purple glow border (1px)
- Subtle backdrop blur
- Padding: p-6 to p-8
- Rounded corners: rounded-xl

### Buttons
**Primary**: Purple gradient fill (#6A00FF → #8B2CFF), white text, outer white glow (box-shadow: 0 0 20px rgba(255,255,255,0.3))
**Secondary**: Ghost style, thin white glow border, hover increases intensity
**Icon Buttons**: Square/circle, minimal padding, same glow treatment

### Form Inputs
- Dark transparent background with purple tint
- Thin purple border, focus state increases glow
- Placeholder text: low-opacity white
- Number inputs: mono font, right-aligned for amounts

### Badges & Labels
- Small pill-shaped containers (px-3 py-1, rounded-full)
- Type indicators: "Buy" (green tint), "Sell" (red tint), "ZK" (purple glow)
- Status icons: shield for privacy, checkmark for complete, spinner for pending

### Data Tables
- Transparent header row with semibold labels
- Alternating row background: subtle purple tint (10% opacity difference)
- Hover state: purple glow outline
- Right-align numerical columns (amounts, prices, percentages)

## Visual Effects

### Glow Treatments
- Primary CTAs: soft white outer glow
- Interactive elements: purple glow on hover/focus
- Status indicators: pulsing glow animation (2s ease-in-out infinite)
- ZK icons: static purple aura

### Micro-Interactions
- Button press: scale(0.98) with 150ms transition
- Card hover: subtle lift (translateY(-2px)) + glow intensity increase
- Input focus: border glow expansion
- Success states: gentle scale pulse (1 → 1.05 → 1)
- All animations respect `prefers-reduced-motion`

## Accessibility
- Semantic HTML: <nav>, <main>, <table>, <form>
- ARIA labels for all icon-only buttons
- Keyboard navigation: visible purple glow focus states
- Form validation: inline error messages with icon indicators
- Color contrast: WCAG AA compliance on all text

## Responsive Behavior
- **Desktop (≥1024px)**: Sidebar visible, multi-column grids
- **Tablet (768-1023px)**: Sidebar collapses to hamburger menu, 2-column grids
- **Mobile (<768px)**: Single column, stacked cards, simplified tables (horizontal scroll or card view)

## Images
No hero images in trading platform. Visual hierarchy relies on glassmorphism cards, data visualization (charts, sparklines), and icon-driven navigation. Background: subtle CSS starfield particles for depth consistency with landing page.

## Privacy-First Messaging
- Replace "Your Wallet" → "Stealth Vault"
- Transaction hashes: Always truncated, never full addresses
- Toast notifications: "Trade executed anonymously" instead of "Transaction confirmed"
- Footer tagline: "Built for invisible traders"