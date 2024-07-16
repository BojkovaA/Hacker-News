document.addEventListener('DOMContentLoaded', function() {
    const navDivs = document.querySelectorAll('.custom-list .custom-list-div');
    const navItems = document.querySelectorAll('.nav-item .nav-link');
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');
    const resultsCount = document.querySelector('.results p');

    let storyIds = [];
    let currentPage = 0;
    const storiesPerPage = 20;
    let currentSort = 'date';
    let currentTimePeriod = 'forever';
    let currentFilter = '';
    let currentSearchText = '';
    let isLoading = false;
    let favoriteStories = JSON.parse(localStorage.getItem('favoriteStories')) || [];

    // Initial fetch of stories sorted by date
    fetchTopStories(currentSort, currentTimePeriod, currentFilter);


    // Event listeners for navigation filters
    navDivs.forEach(div => {
        div.addEventListener('click', function() {
            const filterType = this.id;

            navDivs.forEach(div => div.classList.remove('active'));
            this.classList.add('active');

            currentFilter = filterType;
            currentPage = 0; // Reset to the first page
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);

            if (filterType === 'all' || filterType === 'starred') {
                categorySelect.disabled = false;
                categorySelect.classList.remove('disabled-option');
                categorySelect.value = 'all';
            } else {
                categorySelect.disabled = true;
                categorySelect.classList.add('disabled-option');
                categorySelect.value = 'all';
                currentFilterType = 'all';
                fetchTopStories(currentSort, currentTimePeriod, currentFilter);
            }
        });
    });

    //event listener for date and popularity filter
    navItems.forEach(navLink => {
        navLink.addEventListener('click', function(event) {
            event.preventDefault();
            navItems.forEach(link => link.classList.remove('active'));
            event.target.classList.add('active');

            currentSort = event.target.id === 'sort-by-date' ? 'date' : 'popularity';
            currentPage = 0;
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        });
    });

    // Event listener for time period radio buttons
    document.querySelectorAll('input[name="time-period"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentTimePeriod = getSelectedTimePeriod();
            currentPage = 0;
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        });
    });

    // Event listener for search input
    searchInput.addEventListener('input', function() {
        currentSearchText = this.value.trim().toLowerCase();
        if (currentSearchText.length >= 2) {
            currentPage = 0;
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        }
    });

    //Event listener for selecting an option in search
    categorySelect.addEventListener('change', function() {
        currentFilter = this.value;
        currentPage = 0; // Reset to the first page
        fetchTopStories(currentSort, currentTimePeriod, currentFilter);
    });

    // Scroll event listener for pagination
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) / document.querySelector('.list-all').scrollHeight >= 0.6 && !isLoading) {
            currentPage++;
            const start = currentPage * storiesPerPage;
            const end = start + storiesPerPage;
            const paginatedStoryIds = storyIds.slice(start, end);
            loadStories(paginatedStoryIds, currentSort, currentTimePeriod);
        }
    });

    // Function to fetch story details by ID
    async function getStoryDetails(storyId) {
        try {
            let time1 = performance.now();
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json?print=pretty`);
            let time2 = performance.now();
            return await response.json();
        } catch (error) {
            console.error(`Error fetching story ${storyId}:`, error);
        }
    }


    // Function to fetch top stories based on sort, time period, and filter

    async function fetchTopStories(sortBy, timePeriod, filterType) {
        const startTime = performance.now()
        let apiUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty';

        if (filterType === 'hot') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/newstories.json?print=pretty';
        } else if (filterType === 'show-hn') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/showstories.json?print=pretty';
        } else if (filterType === 'ask-hn') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/askstories.json?print=pretty';
        } else if (filterType === 'poll') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/pollstories.json?print=pretty';
        } else if (filterType === 'job') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/jobstories.json?print=pretty';
        }

        try {
            const response = await fetch(apiUrl);
            storyIds = await response.json();

            // If 'starred' filter is selected, use favorite stories
            if (currentFilter === 'starred') {
                storyIds = favoriteStories;
            }


            if (storyIds.length === 0) {
                renderNoStoriesMessage();
            } else {
                currentPage = 0;
                const paginatedStoryIds = storyIds.slice(0, storiesPerPage);
                loadStories(paginatedStoryIds, sortBy, timePeriod);
            }
            const endTime = performance.now(); // End timing
            const duration = ((endTime - startTime) / 1000).toFixed(4)
            resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
        } catch (error) {
            console.error('Error fetching stories:', error);
            renderNoStoriesMessage();

        }
    }

    // Function to load and render stories based on IDs, sort, and time period
    async function loadStories(storyIds, sortBy, timePeriod) {
        isLoading = true;
        const listAll = document.querySelector('.list-all');
        if (currentPage === 0) {
            listAll.innerHTML = '';
        }

        for (let storyId of storyIds) {
            const storyData = await getStoryDetails(storyId);

            // Filter and sort the single story before rendering
            const filteredStory = filterAndSortStories([storyData], sortBy, timePeriod);
            if (filteredStory.length > 0) {
                renderStory(filteredStory[0], sortBy);
            }
        }

        isLoading = false;

        // Reattach star click listeners after rendering
        onClickStars();
    }


    // Function to filter and sort stories based on search text, sort criteria, and time period
    function filterAndSortStories(stories, sortBy, timePeriod) {
        const now = new Date();
        const filteredStories = stories.filter(storyData => {
            const storyDate = new Date(storyData.time * 1000);
            const timeDiff = now - storyDate;

            // Check if search text matches title
            const titleMatches = storyData.title.toLowerCase().includes(currentSearchText);
            const authorMatches = storyData.by.toLowerCase().includes(currentSearchText);
            const urlMatches = storyData.url ? storyData.url.toLowerCase().includes(currentSearchText) : false;

            const searchMatches = titleMatches || authorMatches || urlMatches;


            // Filter by time period
            let timePeriodMatches = true;
            switch (timePeriod) {
                case 'last-24h':
                    timePeriodMatches = timeDiff < 24 * 60 * 60 * 1000;
                    break;
                case 'past-week':
                    timePeriodMatches = timeDiff < 7 * 24 * 60 * 60 * 1000;
                    break;
                case 'past-month':
                    timePeriodMatches = timeDiff < 30 * 24 * 60 * 60 * 1000;
                    break;
                case 'forever':
                    timePeriodMatches = true;
                    break;
            }

            // Return true if any match found
            return searchMatches && timePeriodMatches;
        });

        // Sort stories by date or popularity
        if (sortBy === 'date') {
            filteredStories.sort((a, b) => b.time - a.time);
        } else if (sortBy === 'popularity') {
            filteredStories.sort((a, b) => b.score - a.score);
        }

        return filteredStories;
    }


    async function getCommentDetails(commentId) {
        try {
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json?print=pretty`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching comment ${commentId}:`, error);
        }
    }

    // Function to render a comment and its replies
    function renderComment(commentData, depth = 0) {
        const timeAgo = formatTime(commentData.time);
        const repliesContainerId = `replies-${commentData.id}`;

        let commentHtml = `
            <div class="comment" data-id="${commentData.id}" style="margin-left: ${depth * 20}px;">
                <div class="comment-header">
                    <span class="comment-author">${commentData.by}</span>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <div class="comment-text">${commentData.text}</div>
                <div class="comment-actions">
                    ${commentData.kids ? `<button class="replies-btn" data-id="${commentData.id}" data-depth="${depth}">Show Replies (${commentData.kids.length})</button>` : ''}
                </div>
                <div id="${repliesContainerId}" class="replies-container"></div>
            </div>
        `;
        return commentHtml;
    }

    // Function to load and render comments recursively
    async function loadComments(commentIds, container, depth = 0) {
        for (let commentId of commentIds) {
            const commentData = await getCommentDetails(commentId);
            const commentHtml = renderComment(commentData, depth);
            container.innerHTML += commentHtml;
        }
        addRepliesEventListeners();
    }

    // Function to handle the show replies button click
    async function handleRepliesClick(event) {
        const button = event.target;
        const commentId = button.dataset.id;
        const depth = parseInt(button.dataset.depth) + 1;
        const repliesContainer = document.getElementById(`replies-${commentId}`);

        if (repliesContainer.innerHTML.trim() === '') {

            const commentData = await getCommentDetails(commentId);
            if (commentData.kids) {
                await loadComments(commentData.kids, repliesContainer, depth);
            }
            button.textContent = `Hide Replies (${commentData.kids.length})`;
        } else {
            // Ako veke se prikazani odgovorite, gi skriva
            repliesContainer.innerHTML = '';
            const commentData = await getCommentDetails(commentId);
            button.textContent = `Show Replies (${commentData.kids.length})`;
        }
        repliesContainer.classList.toggle('hidden');
    }


    function addRepliesEventListeners() {
        document.querySelectorAll('.replies-btn').forEach(button => {
            button.onclick = handleRepliesClick;
        });
    }


    function renderStory(storyData, sortBy) {
        const listAll = document.querySelector('.list-all');
        const timeAgo = formatTime(storyData.time);

        const isFavorite = favoriteStories.includes(storyData.id);
        const starClass = isFavorite ? 'fa-star checked' : 'fa-star';

        const storyHtml = `
        <div class="story d-flex flex-column mb-1 p-3 bg-white" data-story-id="${storyData.id}" data-story-time="${storyData.time}" data-score="${storyData.score+storyData.descendants}">
            <div class="d-flex align-items-center">
                <img class="story-img me-3" src="photos/all.png" alt="Story Image">
                <div>
                    <p style="margin: 0;">${storyData.title}</p>
                    <div class="post-details" style="color: gray; font-size: 0.9em;">
                        <span class="heart" data-id="${storyData.id}">
                            <img src="photos/heart.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">
                            <span class="points">${storyData.score}</span> points
                        </span> |
                        <span><img src="photos/user.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">${storyData.by}</span> |
                        <span><img src="photos/clock.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">${timeAgo}</span> |
                        <a class="story-url" target="_blank" href="${storyData.url}"><span>${storyData.url ? new URL(storyData.url).hostname : ''}</span></a>
                    </div>
                </div>
                <div class="ms-auto d-flex align-items-center">
                    <div class="comment-btn" data-id="${storyData.id}">
                        <img class="chat me-2" src="photos/chat.png" alt="Chat Icon">
                        <p class="comments mb-0">${storyData.descendants || 0} comments</p>
                    </div>
                    <img class="share ms-2" src="photos/share.png" alt="Share">
                    <span class="fa ${starClass}"></span>
                </div>
            </div>
            <div class="comment-section comments-container" style="display: none"></div>
        </div>
    `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = storyHtml.trim();
        const newStoryElement = tempDiv.firstChild;

        if (sortBy === 'popularity') {
            // Add the new story to the appropriate position based on score
            let inserted = false;
            const existingStories = Array.from(listAll.children);
            for (let i = 0; i < existingStories.length; i++) {
                const existingStoryScore = parseInt(existingStories[i].dataset.score, 10);
                if (storyData.score + storyData.descendants > existingStoryScore) {
                    listAll.insertBefore(newStoryElement, existingStories[i]);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                listAll.appendChild(newStoryElement);
            }
        } else {
            listAll.appendChild(newStoryElement);
        }


        if (sortBy === 'date'){
            // Add the new story to the appropriate position based on time
            let inserted = false;
            const existingStories = Array.from(listAll.children);
            for (let i = 0; i < existingStories.length; i++) {
                const existingStoryTime = parseInt(existingStories[i].dataset.storyTime, 10);
                if (storyData.time > existingStoryTime) {
                    listAll.insertBefore(newStoryElement, existingStories[i]);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                listAll.appendChild(newStoryElement);
            }
        }

        onClickStars();
        addHeartEventListeners();
        addCommentEventListeners();
    }

    function addCommentEventListeners() {
        document.querySelectorAll('.comment-btn').forEach(button => {
            button.onclick = async function() {
                const storyId = this.dataset.id;
                const storyElement = this.closest('.story');
                const commentsContainer = storyElement.querySelector('.comments-container');

                if (!storyElement.dataset.commentsFetched) {
                    // Load and show comments
                    getStoryDetails(storyId).then(story => {
                        if (story.kids) {
                            loadComments(story.kids, commentsContainer);
                        }
                        commentsContainer.style.display = 'block';
                        storyElement.dataset.commentsFetched = true; // Mark as comments fetched
                    });
                } else {
                    // Toggle display of comments
                    if (commentsContainer.style.display === 'none') {
                        commentsContainer.style.display = 'block';
                    } else {
                        commentsContainer.style.display = 'none';
                    }
                }
            }
        });
    }

    // Function to handle star (favorite) click events
    function onClickStars() {
        document.querySelectorAll('.fa-star').forEach(star => {
            star.removeEventListener('click', handleStarClick); // Remove previous click listeners
            star.addEventListener('click', handleStarClick); // Add new click listeners
        });
    }

    // Function to handle star (favorite) click event
    function handleStarClick() {
        const storyId = this.closest('.story').dataset.storyId;
        if (!storyId) return;

        const storyIdNumber = Number(storyId);
        const isFavorite = favoriteStories.includes(storyIdNumber);

        if (isFavorite) {
            favoriteStories = favoriteStories.filter(id => id !== storyIdNumber);
        } else {
            favoriteStories.push(storyIdNumber);
        }

        this.classList.toggle('checked', !isFavorite);
        localStorage.setItem('favoriteStories', JSON.stringify(favoriteStories));
    }

    function addHeartEventListeners() {
        document.querySelectorAll('.heart').forEach(heart => {
            heart.onclick = () => toggleHeart(heart);
        });
    }

    function toggleHeart(heart) {
        const storyId = heart.dataset.id;
        const pointsSpan = heart.querySelector('.points');
        const points = parseInt(pointsSpan.textContent, 10);

        if (heart.classList.contains('active')) {
            // Remove the heart and decrement the points
            heart.classList.remove('active');
            pointsSpan.textContent = points - 1;

        } else {
            // Add the heart and increment the points
            heart.classList.add('active');
            pointsSpan.textContent = points + 1;

        }
    }

    // Function to get selected time period from radio buttons
    function getSelectedTimePeriod() {
        return document.querySelector('input[name="time-period"]:checked').value;
    }

    // Function to format timestamp to 'time ago' format
    function formatTime(timestamp) {
        const now = new Date();
        const then = new Date(timestamp * 1000);
        let diff = Math.floor((now - then) / 1000);
        const units = [
            { label: 'second', value: 60 },
            { label: 'minute', value: 60 },
            { label: 'hour', value: 24 },
            { label: 'day', value: 30 },
            { label: 'month', value: 12 },
            { label: 'year', value: Number.MAX_SAFE_INTEGER }
        ];

        for (let i = 0; i < units.length; i++) {
            if (diff < units[i].value) {
                return `${diff} ${units[i].label}${diff > 1 ? 's' : ''} ago`;
            }
            diff = Math.floor(diff / units[i].value);
        }

        return 'a long time ago';
    }

    function renderNoStoriesMessage() {
        const listAll = document.querySelector('.list-all');
        resultsCount.textContent = `0 results (0 seconds)`;
        listAll.innerHTML = `<p class="text-center mt-3">No ${currentFilter}s  available.</p>`;
    }

    //onClickStars();
});
