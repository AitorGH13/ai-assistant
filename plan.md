# Plan: Professional Frontend Redesign

**TL;DR:** Transform the AI assistant frontend into a modern, minimalist, and fully responsive chat interface with professional polish. Will implement a custom design system with light/dark themes, markdown/code rendering, enhanced UX features (timestamps, copy buttons, avatars), and mobile-optimized layouts while maintaining all existing functionality.

## Steps

### Setup dependencies and design system foundation
- Install required packages: `react-markdown`, `react-syntax-highlighter`, `lucide-react` (icons), `@fontsource/inter` (typography)
- Update `tailwind.config.js` with custom theme:
    - Modern color palette (slate-based neutrals, indigo/violet accents for AI feel)
    - Typography scale using Inter font family
    - Custom spacing and design tokens
    - Dark/light mode configuration
- Update `index.css` to import Inter font and remove hardcoded dark theme
- Create new `theme.ts` utility for managing light/dark mode state

### Create enhanced component library
- Create `components/ui/Avatar.tsx` for user/AI avatars (using lucide-react icons)
- Create `components/ui/Button.tsx` with consistent styling variants
- Create `components/ui/IconButton.tsx` for toolbar actions
- Create `components/ui/ThemeToggle.tsx` for dark/light mode switcher
- Create `components/MarkdownMessage.tsx` wrapping `react-markdown` with syntax highlighting for code blocks and copy buttons
- Update `components/index.ts` to export new components

### Redesign ChatMessage component with professional polish
- Update `components/ChatMessage.tsx`:
    - Replace inline text with `MarkdownMessage` for rich content rendering
    - Add `Avatar` component for user/AI identification
    - Add timestamp display (require timestamp in Message type)
    - Add copy button using `IconButton`
- Implement responsive layout (horizontal on desktop, compact on mobile)
- Apply modern minimalist styling with ample spacing
- Remove squared corner effect, use consistent rounded corners
- Reduce max-width from 80% to better use of space

### Enhance ChatInput with modern UX
- Update `components/ChatInput.tsx`:
    - Increase min-height for multi-line visibility
    - Add subtle border/shadow for depth
    - Improve button styling with better loading state
    - Add responsive touch targets (larger on mobile)
    - Apply glassmorphism subtle blur effect on focus
    - Replace inline SVG with lucide-react `Send` icon

### Redesign SettingsPanel for better usability
- Update `components/SettingsPanel.tsx`:
    - Replace inline SVG icons with lucide-react (Settings, `ChevronDown`, `ChevronUp`)
    - Improve accordion animation and spacing
    - Add responsive behavior (slide-in modal on mobile, inline on desktop)
    - Enhance textarea styling consistency
    - Better visual hierarchy with subtle backgrounds

### Transform App.tsx layout with responsive design
- Update `src/App.tsx`:
    - Add theme context/state management
- Update Message type in `types.ts` to include `timestamp: string`
- Add timestamps when creating messages
- Redesign header layout:
    - Add `ThemeToggle` component
    - Improve spacing and visual hierarchy
    - Make responsive (compact on mobile)
- Enhance empty state:
    - Replace inline SVG with lucide-react icon
    - Add quick suggestion buttons (example prompts)
    - Better visual design with centered layout
- Implement responsive breakpoints throughout:
    - Mobile: single column, full width, compact spacing
    - Tablet: optimized padding and max-width
    - Desktop: max-width with ample margins
- Add subtle background gradients/patterns for depth
- Improve messages container scrolling UX

### Polish and refinements
- Add smooth transitions and micro-animations (message fade-in, button hovers)
- Implement scroll-to-top button for long conversations
- Add loading skeleton for streaming messages
- Ensure all interactive elements have proper focus states
- Test and refine responsive breakpoints
- Optimize spacing consistency across all viewport sizes
- Verify color contrast ratios for accessibility (WCAG AA)

## Verification
- Run `npm run dev` in client directory and test on:
    - Mobile viewport (375px width) - verify touch targets, layout, readability
    - Tablet viewport (768px width) - verify responsive adaptations
    - Desktop viewport (1440px+ width) - verify max-width constraints and spacing
- Toggle dark/light theme and verify all components render correctly in both modes
- Send messages with markdown, code blocks, lists - verify rendering with syntax highlighting
- Test copy buttons on messages
- Test settings panel on mobile vs desktop
- Verify timestamps appear on all messages
- Test empty state suggestions clickability
- Check keyboard navigation and focus states
- Verify smooth scrolling and animations

## Decisions
- **Design direction:** Modern minimalist with ample whitespace and subtle colors
- **Color palette:** Slate-based neutrals with indigo/violet accents for professional AI aesthetic
- **Typography:** Inter font family for modern, readable interface
- **Theme support:** Full light/dark mode toggle with system preference detection
- **Features:** Complete set - markdown/code rendering, timestamps, copy buttons, avatars, empty state suggestions
- **Responsive strategy:** Mobile and desktop equal priority with tablet optimization
- **Icon system:** `lucide-react` for consistent, lightweight SVG icons
- **Markdown library:** `react-markdown` with `react-syntax-highlighter` for code blocks