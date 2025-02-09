# Bootstrap Migration Plan

## Overview
This plan outlines the process of migrating the current custom CSS frontend to Bootstrap 5 with Inter typography, preparing the application for the Plaid integration and other future enhancements.

## Migration Strategy

### 1. Setup and Dependencies

1. Add Dependencies
```html
<!-- In templates/layout.html -->
<head>
    <!-- Inter Font -->
    <link rel="preconnect" href="https://rsms.me/">
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
    <!-- Custom CSS (for Bootstrap overrides) -->
    <link rel="stylesheet" href="/styles/custom.css">
</head>
<body>
    <!-- Content -->
    
    <!-- Bootstrap Bundle with Popper -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
```

2. Create Custom Theme with Typography
```scss
// styles/custom.scss

// Font configuration
$font-family-sans-serif: "Inter var", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
$font-family-base: $font-family-sans-serif;

// Font weights
$font-weight-lighter: 300;
$font-weight-light: 400;
$font-weight-normal: 500;
$font-weight-bold: 600;
$font-weight-bolder: 700;

// Line heights
$line-height-base: 1.6;
$line-height-sm: 1.4;
$line-height-lg: 1.8;

// Heading sizes with Inter adjustments
$h1-font-size: 2.25rem;  // 36px
$h2-font-size: 1.875rem; // 30px
$h3-font-size: 1.5rem;   // 24px
$h4-font-size: 1.25rem;  // 20px
$h5-font-size: 1.125rem; // 18px
$h6-font-size: 1rem;     // 16px

// Theme colors
$primary: #333;
$secondary: #6c757d;
$success: #28a745;
$info: #17a2b8;
$warning: #ffc107;
$danger: #dc3545;

// Import Bootstrap
@import "bootstrap/scss/bootstrap";

// Typography Overrides
body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
}

// Heading styles
h1, h2, h3, h4, h5, h6,
.h1, .h2, .h3, .h4, .h5, .h6 {
    font-weight: $font-weight-bold;
    letter-spacing: -0.02em;
}

// Numeric values (for financial data)
.numeric {
    font-feature-settings: "tnum" 1;
    font-variant-numeric: tabular-nums;
}

// Table headers
.table thead th {
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
}

// Form labels
.form-label {
    font-weight: $font-weight-bold;
    font-size: 0.875rem;
}

// Navigation
.navbar-brand {
    font-weight: $font-weight-bolder;
    letter-spacing: -0.03em;
}

.nav-link {
    font-weight: $font-weight-normal;
}

// Cards
.card-title {
    font-weight: $font-weight-bold;
    letter-spacing: -0.01em;
}

// Buttons
.btn {
    font-weight: $font-weight-bold;
    letter-spacing: 0.01em;
}

// Financial amounts
.amount {
    font-feature-settings: "tnum" 1;
    font-variant-numeric: tabular-nums;
    font-weight: $font-weight-normal;
}

.amount-large {
    @extend .amount;
    font-size: 1.25rem;
    font-weight: $font-weight-bold;
}

// Small text and captions
small, .small {
    font-size: 0.875rem;
    font-weight: $font-weight-normal;
}
```

### 2. Component Migration with Typography

#### 1. Navigation
```html
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="/">Personal Finance Bookkeeper</a>
        <div class="collapse navbar-collapse">
            <ul class="navbar-nav">
                <li class="nav-item">
                    <a class="nav-link" href="/index.html">Balance Sheet</a>
                </li>
            </ul>
        </div>
    </div>
</nav>
```

#### 2. Financial Data Display
```html
<!-- Balance display with proper numeric alignment -->
<div class="amount-large numeric">€1,234,567.89</div>

<!-- Table with financial data -->
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr>
                <th>Account</th>
                <th class="text-end">Balance</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Checking Account</td>
                <td class="text-end numeric">€1,234.56</td>
            </tr>
        </tbody>
    </table>
</div>
```

#### 3. Forms with Enhanced Typography
```html
<div class="mb-3">
    <label class="form-label">Account Name</label>
    <input type="text" class="form-control" placeholder="Enter account name">
    <small class="form-text text-muted">Choose a descriptive name for this account</small>
</div>
```

### 3. Typography-Specific Testing

1. Font Loading
   - Verify Inter loads correctly
   - Check font fallbacks
   - Test font loading performance

2. Readability Testing
   - Test different font sizes
   - Verify line heights
   - Check contrast ratios
   - Test numeric alignment

3. Responsive Typography
   - Test font scaling
   - Check heading sizes
   - Verify table readability
   - Test financial data display

4. Cross-Browser Testing
   - Verify font rendering
   - Check OpenType features
   - Test variable font support

### 4. Implementation Phases (Updated)

#### Phase 1: Typography and Bootstrap Setup (3 days)
1. Add Inter font integration (0.5 day)
2. Set up custom typography variables (0.5 day)
3. Create typography utility classes (1 day)
4. Configure responsive typography (1 day)

#### Phase 2: Core Components (3 days)
1. Navigation bar
2. Forms and inputs
3. Tables and data displays
4. Buttons and actions
5. Cards and sections

#### Phase 3: Page Migration (4 days)
1. Balance Sheet (1 day)
2. Income Statement (1 day)
3. Categories (1 day)
4. Accounts (1 day)

#### Phase 4: Polish & Testing (4 days)
1. Typography testing (1 day)
2. Responsive testing (1 day)
3. Cross-browser testing (1 day)
4. Performance optimization (1 day)

Total Estimated Time: 14 days

### 5. Typography Best Practices

1. Financial Data
   - Use tabular numbers for amounts
   - Consistent decimal alignment
   - Clear thousand separators
   - Proper currency symbol spacing

2. Hierarchy
   - Clear heading hierarchy
   - Consistent font weights
   - Appropriate line heights
   - Proper spacing between elements

3. Responsive Considerations
   - Fluid typography scaling
   - Minimum font sizes for readability
   - Appropriate line lengths
   - Mobile-friendly spacing

4. Performance
   - Proper font subsetting
   - Variable font usage
   - Font loading optimization
   - FOUT/FOIT handling

### 6. Future Typography Enhancements

1. Dark Mode
   - Adjust font weights for dark mode
   - Optimize contrast ratios
   - Consider different line heights
   - Adjust letter spacing

2. Print Styles
   - Optimize typography for printing
   - Ensure readable font sizes
   - Maintain numeric alignment
   - Clear financial data presentation

3. Internationalization
   - Support for multiple languages
   - RTL text support
   - Number formatting by locale
   - Currency display options

4. Advanced Typography
   - OpenType features usage
   - Fraction handling
   - Currency symbol alignment
   - Advanced metric formatting
``` 