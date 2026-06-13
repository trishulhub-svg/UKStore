// Custom PostCSS plugin to remove Tailwind-generated bg-[url('...')] classes
// that cause "Module not found" errors in Turbopack/webpack CSS resolution
// when url() values are treated as module imports
const postcss = require('postcss');

const removeUrlClasses = postcss.plugin('remove-url-classes', () => {
  return (root) => {
    root.walkRules((rule) => {
      // Remove any rule whose selector contains url( — these are Tailwind
      // bg-[url('...')] utility classes that cause CSS module resolution errors
      if (rule.selector && rule.selector.includes('url\\(')) {
        rule.remove();
        return;
      }
      // Also remove rules with HTML-entity-encoded url references
      if (rule.selector && (rule.selector.includes('#x27') || rule.selector.includes('&#x'))) {
        rule.remove();
        return;
      }
      // Clean up any remaining url() declarations with problematic values
      rule.walkDecls((decl) => {
        if (decl.value && decl.value.includes('url(') && !decl.value.includes('data:')) {
          // Check if this is a CSS variable reference (safe to keep)
          if (!decl.value.includes('var(')) {
            decl.remove();
          }
        }
      });
    });
  };
});

module.exports = removeUrlClasses;
