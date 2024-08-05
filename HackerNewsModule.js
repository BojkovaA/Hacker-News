const HackerNewsModule = () => {
    const returnObj = {}
    const api = `https://hacker-news.firebaseio.com/v0`;
    returnObj.init = (elements) =>{

        const { navDivs, navItems, searchInput, categorySelect, resultsCount } = elements;

        let storyIds = [];
        let currentPage = 0;
        let storiesPerPage = 20;
        let currentSort = 'date';
        let currentTimePeriod = 'forever';
        let currentFilter = '';
        let currentSearchText = '';
        let searched=false;
        let isLoading = false;
        let favoriteStories = JSON.parse(localStorage.getItem('favoriteStories')).reverse() || [];


        let stopFetching = false;
        let currentFetchTask = null;

        console.log(favoriteStories)
        // Initial fetch of stories sorted by date
        fetchStories(fetchTopStories,currentSort, currentTimePeriod, currentFilter);



        async function fetchStories() {
            if (currentFetchTask) {
                stopFetching = true;
                await currentFetchTask;
            }
            stopFetching = false;
            currentFetchTask = fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        }

        //Function to handle side navbar filter
        async function handleNavClick(filterType) {
            setActiveFilter(navDivs, document.getElementById(filterType));
            currentFilter = filterType;
            currentPage = 0;
            await fetchStories();
            updateCategorySelect(filterType);
        }

        // Event listeners for navigation filters
        if(navDivs){
            navDivs.forEach(div => {
                div.addEventListener('click', function() {
                    handleNavClick(this.id);
                });
            });
        }



        //Function to handle time and period filter
        async function handleNavItems(event){
            event.preventDefault();
            setActiveFilter(navItems, event.target);
            currentSort = event.target.id === 'sort-by-date' ? 'date' : 'popularity';
            currentPage = 0;
            await fetchStories();
        };

        //Event listener for date and popularity filter
        if (navItems) {
            navItems.forEach(navLink => {
                navLink.addEventListener('click', function(event){
                    handleNavItems(event);
                });
            });
        }



        // Function to handle time period change
        async function handleTimePeriodChange() {
            currentTimePeriod = getSelectedTimePeriod();
            currentPage = 0;
            await fetchStories();
        }

        // Event listener for time period radio buttons
        document.querySelectorAll('input[name="time-period"]').forEach(radio => {
            radio.addEventListener('change', handleTimePeriodChange);
        });



        let searchTimeout;
        // Function to handle search input
        async function handleSearchInput(event) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                currentSearchText = event.target.value.trim().toLowerCase();

                if (currentSearchText.length >= 2) {
                    currentPage = 0; // Reset to the first page
                    searched = true;
                    await fetchStories();
                } else if (currentSearchText.length < 1) {
                    currentPage = 0;
                    document.querySelector('.list-all').innerHTML = '';
                    searched = false;
                    await fetchStories();
                }
            }, 1500);
        }

        // Event listener for the search input
        if(searchInput){
            searchInput.addEventListener('input', handleSearchInput);
        }


        //Function to handle category selection
        async function handleCategorySelect(){
            currentFilter = this.value;
            currentPage = 0;
            await fetchStories();
        }

        //Event listener for selecting an option in search
        if(categorySelect){
            categorySelect.addEventListener('change',  handleCategorySelect);
        }


        // Function to handle scroll for pagination
        function handleScrollForPagination() {
            if ((window.innerHeight + window.scrollY) / document.querySelector('.list-all').scrollHeight >= 0.6 && !isLoading) {
                currentPage++;
                const start = currentPage * storiesPerPage;
                const end = start + storiesPerPage;
                let paginatedStoryIds = storyIds.slice(start, end);
                //paginatedStoryIds = paginatedStoryIds.filter(id => !storyIds.includes(id));
                loadStories(paginatedStoryIds, currentSort, currentTimePeriod);
            }
        }

        // Scroll event listener for pagination
        window.addEventListener('scroll', handleScrollForPagination);




        // Function to fetch story details by ID
        async function getStoryDetails(storyId) {
            try {
                let time1 = performance.now();
                const response = await fetch(`${api}/item/${storyId}.json?print=pretty`);
                let time2 = performance.now();
                return await response.json();
            } catch (error) {
                console.error(`Error fetching story ${storyId}:`, error);
            }
        }


        // Function to fetch top stories based on sort, time period, and filter
        async function fetchTopStories(sortBy, timePeriod, filterType) {
            const startTime = performance.now()
            const apiUrl = getApiUrl(filterType);

            try {
                const response = await fetch(apiUrl);
                storyIds = await response.json();
                if (filterType !== 'hot') {
                    storyIds.sort((a, b) => b - a);
                }
                // If 'starred' filter is selected, use favorite stories
                if (currentFilter === 'starred') {
                    storyIds = favoriteStories;
                }


                await handleStoryIds(storyIds, sortBy, timePeriod);


                const duration = endPerformanceTiming(startTime);
                if(resultsCount){
                    resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
                }            } catch (error) {
                handleFetchError(error);
                renderNoStoriesMessage();

            }
        }


        async function handleStoryIds(storyIds, sortBy, timePeriod) {
            if (storyIds.length === 0) {
                renderNoStoriesMessage();
            } else {
                let paginatedStoryIds = searched ? storyIds : storyIds.slice(0, storiesPerPage);
                await loadStories(paginatedStoryIds, sortBy, timePeriod);
            }
        }

        function handleFetchError(error) {
            console.error('Error fetching stories:', error);
        }

        function endPerformanceTiming(startTime) {
            const endTime = performance.now();
            return ((endTime - startTime) / 1000).toFixed(4);
        }


        function getApiUrl(filterType) {
            switch (filterType) {
                case 'hot': return `${api}/newstories.json?print=pretty`;
                case 'show-hn': return `${api}/showstories.json?print=pretty`;
                case 'ask-hn': return `${api}/askstories.json?print=pretty`;
                case 'poll': return `${api}/pollstories.json?print=pretty`;
                case 'job': return `${api}/jobstories.json?print=pretty`;
                default: return `${api}/topstories.json?print=pretty`;
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
                if (stopFetching) break;
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


        // Function to check if a story matches the search criteria
        function matchesSearch(storyData, searchText) {
            try {
                const titleMatches = storyData.title && storyData.title.toLowerCase().includes(searchText);
                const authorMatches = storyData.by && storyData.by.toLowerCase().includes(searchText);
                const urlMatches = storyData.url && storyData.url.toLowerCase().includes(searchText);

                return titleMatches || authorMatches || urlMatches;
            } catch (error) {
                console.error('Error in matchesSearch:', error);
                return false; // Return false if any error occurs
            }
        }


        // Function to check if a story falls within the selected time period
        function matchesTimePeriod(storyData, timePeriod) {
            const now = new Date();
            const storyDate = new Date(storyData.time * 1000);
            const timeDiff = now - storyDate;

            switch (timePeriod) {
                case 'last-24h':
                    return timeDiff < 24 * 60 * 60 * 1000;
                case 'past-week':
                    return timeDiff < 7 * 24 * 60 * 60 * 1000;
                case 'past-month':
                    return timeDiff < 30 * 24 * 60 * 60 * 1000;
                case 'forever':
                    return true;
                default:
                    return false;
            }
        }

        // Main filter and sort function
        function filterAndSortStories(stories, sortBy, timePeriod) {
            const filteredStories = stories.filter(storyData =>
                matchesSearch(storyData, currentSearchText) && matchesTimePeriod(storyData, timePeriod)
            );

            // Sort stories by date or popularity
            if (sortBy === 'date') {
                filteredStories.sort((a, b) => b.time - a.time);
            } else if (sortBy === 'popularity') {
                filteredStories.sort((a, b) => b.score - a.score);
            }

            return filteredStories;
        }

        //Function to get comment details
        async function getCommentDetails(commentId) {
            try {
                const response = await fetch(`${api}/item/${commentId}.json?print=pretty`);
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

            if (currentFilter === 'starred') {
                fetchTopStories(currentSort, currentTimePeriod, currentFilter);
            }
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

            heart.classList.toggle('active');
            pointsSpan.textContent = heart.classList.contains('active') ? points + 1 : points - 1;

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
            if(resultsCount){
                resultsCount.textContent = `0 results (0 seconds)`;
            }
            listAll.innerHTML = `<p class="text-center mt-3">No ${currentFilter}s  available.</p>`;
        }

        function setActiveFilter(navElements, activeElement) {
            navElements.forEach(div => div.classList.remove('active'));
            activeElement.classList.add('active');
        }

        function updateCategorySelect(filterType) {
            if (filterType === 'all' || filterType === 'starred') {
                categorySelect.disabled = false;
                categorySelect.classList.remove('disabled-option');
                categorySelect.value = 'all';
            } else {
                categorySelect.disabled = true;
                categorySelect.classList.add('disabled-option');
                categorySelect.value = 'all';
            }
        }
    }

    return returnObj;
}