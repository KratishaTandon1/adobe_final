# PDF Nav Header CSS Debug Guide

## Fixed Issues:

1. **Removed duplicate `.pdf-viewer-container` definitions** - There were two conflicting definitions
2. **Removed old `.pdf-header` styles** - These were conflicting with new `.pdf-nav-header`
3. **Increased z-index** for `.pdf-nav-header` from 10 to 20 to avoid conflicts with `.panel-header`
4. **Added `flex-shrink: 0`** to prevent the nav header from shrinking
5. **Adjusted height calculation** for PDF viewer container to properly account for the navigation header

## Current CSS Structure:

```css
.pdf-nav-header {
  /* Position: relative, z-index: 20, flex-shrink: 0 */
  /* Height: ~60px (12px + 12px padding + content) */
}

.pdf-viewer-container {
  /* Height: calc(100vh - 240px) */
  /* Display: flex, flex-direction: column */
}
```

## Expected Layout:

```
┌─────────────────────────────────────┐
│ App Header (~80px)                  │
├─────────────────────────────────────┤
│ PDF Nav Header (~60px) - z-index:20 │
├─────────────────────────────────────┤
│                                     │
│ PDF Viewer Container                │
│ (calc(100vh - 240px))              │
│                                     │
└─────────────────────────────────────┘
```

## To Test:

1. Check if PDF nav header shows properly
2. Verify PDF viewer gets adequate space
3. Ensure no overlapping elements
4. Test responsive behavior
