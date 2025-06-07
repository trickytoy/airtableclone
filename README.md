# Airtable Clone Project

This project is an Airtable-like spreadsheet/database app built with the T3 stack, TanStack Table, and PostgreSQL.  
It focuses on performance and usability, supporting very large tables with virtualized infinite scrolling, advanced filtering, sorting, and views.

---

## Project Overview

- Built using [create-t3-app](https://create.t3.gg/)
- Deploys on Vercel
- Uses PostgreSQL for the database
- TanStack Table for the frontend table UI
- tRPC for backend API communication
- Google OAuth for authentication
- Supports bases, tables, columns, and cells (text & number types)
- Smooth inline editing with keyboard navigation
- Virtualized infinite scrolling for very large datasets (100k+ rows)
- Database-level filtering, sorting, searching
- Save and switch between views (filters, sorting, column visibility)

---

## Feature Checklist

### Authentication & Base/Table Management
- ✅ Google Sign-In authentication
- ✅ Users can create multiple **bases**
- ✅ Each base can have multiple **tables**
- [ ] New tables start with default columns and rows (using Faker.js)

### Table UI & Editing
- ✅ Airtable-inspired table UI using TanStack Table
- [ ] Editable column headers (names and types: TEXT, NUMBER)
- ✅ Dynamically add new columns (TEXT and NUMBER)
- ✅ Inline editable cells
- [ ] Smooth tab navigation across cells
- [ ] Default rows and columns generated on table creation

### Performance & Virtualization
- ✅ Use TanStack virtualizer for row virtualization
- [ ] Implement cursor-based pagination via tRPC
- [ ] Button to add 100,000 Faker-generated rows dynamically
- [ ] Smooth scrolling and rendering with 100k+ rows
- [ ] Scalable to 1 million rows without lag

### Search, Filter, and Sort (Database-side)
- [ ] Global search across all cells
- [ ] Column filters:
  - Text: contains, not contains, is empty, is not empty, equals
  - Number: greater than, less than, equals
- [ ] Sorting:
  - Text: A→Z, Z→A
  - Number: ascending, descending
- [ ] Save and load views with filters, sorting, and column visibility
- [ ] Ability to hide/show columns dynamically

### UX & Loading States
- [ ] Loading placeholders/spinners during data fetching
- [ ] Disabled inputs/buttons while saving/loading data
- [ ] Keyboard friendly navigation and editing

---

## Development & Deployment

- Setup with `create-t3-app`
- PostgreSQL database with efficient schema for large tables
- Prisma as ORM
- tRPC for API routes
- Deployment to Vercel


## Future Improvements (Optional)

- Dark mode toggle
- Drag-to-reorder columns
- Undo/Redo history for cell edits
- Bulk row operations (delete, copy)
- Additional column types (date, select, checkbox)

---

## How to Run Locally

```bash
git clone <repo-url>
cd airtable-clone
npm install
npm dev
