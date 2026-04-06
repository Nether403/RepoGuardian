# TagSelector Component

A dropdown component for managing repository tags with inline tag creation.

## Features

- Display available tags with custom colors
- Show selected tags as removable badges
- Add/remove tags from repositories
- Create new tags inline with color picker
- Mobile-optimized dropdown view
- Tier-based access control (Pro/Enterprise only)
- Optimistic UI updates
- Loading and error states

## Usage

```tsx
import { TagSelector } from '@/components/tag-selector';

function RepositoryCard({ repositoryId }: { repositoryId: string }) {
  return (
    <div>
      <TagSelector repositoryId={repositoryId} size="md" />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `repositoryId` | `string` | required | The ID of the repository to manage tags for |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant for the button |
| `className` | `string` | `''` | Additional CSS classes |

## Behavior

### Tag Display
- Shows up to 3 selected tags as colored badges
- Displays "+N" badge if more than 3 tags are selected
- Each badge can be clicked to remove the tag

### Tag Selection
- Opens a popover with all available tags
- Selected tags are highlighted with a checkmark
- Click any tag to toggle its selection
- Changes are applied immediately with optimistic updates

### Tag Creation
- Click "New Tag" button to show creation form
- Enter tag name (max 50 characters)
- Choose custom color with color picker
- New tags are automatically applied to the repository

### Access Control
- Only visible to authenticated Pro/Enterprise users
- Free tier users don't see the component
- Shows upgrade prompt on tier restriction errors

### Mobile Optimization
- Touch-friendly button size (minimum 44x44px)
- Scrollable tag list for many tags
- Optimized dropdown positioning

## API Integration

### Endpoints Used
- `GET /api/tags` - Fetch all user tags
- `GET /api/repositories/:id/tags` - Fetch repository tags
- `POST /api/tags` - Create new tag
- `POST /api/repositories/:id/tags` - Add tag to repository
- `DELETE /api/repositories/:id/tags/:tagId` - Remove tag from repository

### Cache Management
- Tags cached for 10 minutes
- Repository tags cached for 5 minutes
- Automatic cache invalidation on mutations
- Optimistic updates for instant feedback

## Error Handling

- Tier restriction errors show upgrade prompt
- Validation errors display specific messages
- Network errors show retry option
- Automatic retry with exponential backoff

## Accessibility

- Proper ARIA labels for screen readers
- Keyboard navigation support
- Focus management in popover
- Color contrast compliance

## Testing

See `client/src/components/__tests__/tag-selector.test.tsx` for comprehensive test coverage including:
- Tier-based rendering
- Tag display and selection
- Tag creation flow
- Badge removal
- Size variants
- Empty states
