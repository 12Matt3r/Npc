## 2024-05-22 - Keyboard Navigation Visibility
**Learning:** Default browser focus rings are often suppressed by CSS resets or `outline: none`, making navigation impossible for keyboard users.
**Action:** Always include a global `:focus-visible` style that provides a high-contrast outline. Ensure custom components (like search bars) have a visible focus state that matches the design system but remains accessible.
