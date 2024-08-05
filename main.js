document.addEventListener('DOMContentLoaded', function() {
    // Initialize HackerNewsModule
    const elements = {
        navDivs: document.querySelectorAll('.custom-list .custom-list-div'),
        navItems: document.querySelectorAll('.nav-item .nav-link'),
        searchInput: document.getElementById('searchInput'),
        categorySelect: document.getElementById('categorySelect'),
        resultsCount: document.querySelector('.results p')
    };
    HackerNewsModule().init(elements);
});
