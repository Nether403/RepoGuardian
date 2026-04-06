# BookmarkButton Component

A reusable button component for bookmarking repositories. This component is part of the Intelligent User Profile feature and is available only to Pro and Enterprise tier users.

## Features

- ✅ Filled/unfilled bookmark icon states
- ✅ Optimistic UI updates for instant feedback
- ✅ Loading states during API calls
- ✅ User-friendly error messages
- ✅ Size variants (sm, md, lg)
- ✅ Tier-based access control (Pro/Enterprise only)
- ✅ Event propagation prevention (for use in clickable cards)
- ✅ Accessibility support with aria-labels

## Usage

### Basic Usage

```tsx
import { BookmarkButton } from "@/components/bookmark-button";

function RepositoryCard({ repository }) {
  return (
    <div>
      <h3>{repository.name}</h3>
      <BookmarkButton repositoryId={repository.id} />
    </div>
  );
}
```

### With Size Variants

```tsx
// Small size
<BookmarkButton repositoryId="repo-123" size="sm" />

// Medium size (default)
<BookmarkButton repositoryId="repo-123" size="md" />

// Large size
<BookmarkButton repositoryId="repo-123" size="lg" />
```

### With Custom Styling

```tsx
<BookmarkButton 
  repositoryId="repo-123" 
  className="ml-2" 
/>
```

### In a Clickable Card

The component automatically prevents event propagation, making it safe to use inside clickable cards:

```tsx
<Link href={`/repository/${repository.id}`}>
  <Card>
    <CardContent>
      <h3>{repository.name}</h3>
      <BookmarkButton repositoryId={repository.id} />
    </CardContent>
  </Card>
</Link>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `repositoryId` | `string` | required | The ID of the repository to bookmark |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant of the button |
| `className` | `string` | `''` | Additional CSS classes |

## Behavior

### Tier Enforcement
- The button only renders for authenticated Pro and Enterprise users
- Free tier users will not see the button
- Attempting to bookmark as a free user shows an upgrade prompt

### Optimistic Updates
- The UI updates immediately when clicked
- If the API call fails, the UI reverts to the previous state
- Success/error toasts provide feedback

### Bookmark States
- **Unfilled**: Repository is not bookmarked (gray icon)
- **Filled**: Repository is bookmarked (yellow icon with fill)
- **Loading**: Button is disabled during API calls

## API Integration

The component integrates with these API endpoints:
- `GET /api/bookmarks` - Fetch user's bookmarks
- `POST /api/bookmarks` - Add a bookmark
- `DELETE /api/bookmarks/:repositoryId` - Remove a bookmark

## Testing

The component includes comprehensive tests covering:
- Tier-based rendering
- Size variants
- Bookmark state toggling
- Optimistic updates
- Error handling
- Event propagation
- Accessibility

Run tests with:
```bash
npm run test -- client/src/components/__tests__/bookmark-button.test.tsx --run
```

## Requirements Satisfied

This component satisfies the following requirements from the Intelligent User Profile spec:

- **Requirement 1.1**: Display bookmark button on repository cards for Pro/Enterprise users
- **Requirement 1.2**: Save bookmark when clicked on unbookmarked repository
- **Requirement 1.3**: Remove bookmark when clicked on bookmarked repository
- **Requirement 1.8**: Hide bookmark buttons for Free tier users

## Related Components

- `BookmarksTab` - Displays list of bookmarked repositories
- `RepositoryCard` - Repository card that includes the bookmark button
- `TagSelector` - Similar component for tagging repositories
