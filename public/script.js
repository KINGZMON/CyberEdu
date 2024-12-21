// Function to load HTML from a file and insert it into an element
function loadHTML(file, element) {
    fetch('/' + file)
        .then(response => response.text())
        .then(data => {
            document.querySelector(element).innerHTML = data;
            checkLoginState();
            attachLogoutHandler();
        })
        .catch(error => console.log('Error:', error));
}

// Function to check if the user is logged in and update the navbar accordingly
async function checkLoginState() {
    // Fetch the login state from the server
    const response = await fetch('/check-session', {
        method: 'GET',
        credentials: 'include' // Ensure cookies are sent with the request
    });

    // Check if the request was successful
    if (response.ok) {
        const data = await response.json();
        const homeLink = document.getElementById('home-link');
        const loginLink = document.getElementById('login-link');
        const signupLink = document.getElementById('signup-link');
        const dashboardLink = document.getElementById('dashboard-link');
        const logoutLink = document.getElementById('logout-link');
        const dashboardNav = document.getElementById('dashboard-nav');
        const accountLink = document.getElementById('account-link');
        const logoLink = document.querySelector('a.logo-link');

        // Update navigation links based on login state
        if (data.loggedIn) {
            if (homeLink) homeLink.style.display = 'none';
            if (loginLink) loginLink.style.display = 'none';
            if (signupLink) signupLink.style.display = 'none';
            if (dashboardLink) dashboardLink.style.display = 'block';
            if (accountLink) accountLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'block';

            // Change logo link to /search-modules.html when logged in
            if (logoLink) logoLink.href = '/search-modules.html';

            if (dashboardNav) {
                dashboardNav.addEventListener('click', (e) => {
                    e.preventDefault();
                    const role = data.role;
                    if (role === 'learner') {
                        window.location.replace('/learner-dashboard.html');
                    } else if (role === 'tutor') {
                        window.location.replace('/tutor-dashboard.html');
                    }
                });
            }
        } else {
            if (homeLink) homeLink.style.display = 'block';
            if (loginLink) loginLink.style.display = 'block';
            if (signupLink) signupLink.style.display = 'block';
            if (dashboardLink) dashboardLink.style.display = 'none';
            if (accountLink) accountLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'none';

            // Ensure logo link points to the home page when not logged in
            if (logoLink) logoLink.href = '/';
        }
    } else {
        console.error('Failed to check login state:', response.statusText);
    }
}


// Function to fetch and display popular modules
async function fetchPopularModules() {
    const container = document.getElementById('popular-modules-container');
    if (!container) return; // Exit if the container is not present

    try {
        const response = await fetch('/popular-modules');
        if (!response.ok) throw new Error('Failed to fetch popular modules');
        
        const modules = await response.json();
        container.innerHTML = ''; // Clear existing content
        
        modules.forEach(module => {
            const card = document.createElement('div');
            card.classList.add('module-card');
            card.innerHTML = `
                <h3>${module.title}</h3>
                <p style="margin-bottom: 16px;">Difficulty: <strong>${module.difficulty}</strong></p>
                <p><em>${module.completedCount === 1 ? '1 learner levelled up with this!' : `${module.completedCount} learners levelled up with this!`}</em></p>
            `;
            card.addEventListener('click', () => window.location.href = `/modules/${module.slug}.html`);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching popular modules:', error);
    }
}


// Run fetchPopularModules only if the section exists
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('popular-modules-container')) {
        fetchPopularModules();
        setInterval(fetchPopularModules, 120000); // Update every 2 minutes
    }
});



// Function to show a login prompt when a user tries to access module activities.
function showLoginPrompt(container) {
    const loginPrompt = document.createElement('div');
    loginPrompt.classList.add('login-prompt');
    loginPrompt.innerHTML = 'To access the fun activities, <a href="/login.html">login</a>.';
    container.prepend(loginPrompt);
}

// Function to toggle the visibility of the navigation menu
function toggleMenu() {
    const nav = document.querySelector('nav');
    nav.classList.toggle('active');
}

document.addEventListener("DOMContentLoaded", async function() {
    // Load header and footer
    loadHTML("navbar.html", "#navbar-placeholder");
    loadHTML("footer.html", "footer");

    // Check if on leaderboard page
    const isOnLeaderboardPage = document.querySelector('.leaderboard') !== null;
    if(isOnLeaderboardPage){
        updateLeaderboard();
        setInterval(updateLeaderboard, 2 * 60 * 1000); // Update every 2 minutes
    }


    // Only run the module search functionality if the relevant elements exist
    const searchBox = document.getElementById('search-box');
    const difficultyFilter = document.getElementById('difficulty-filter');
    const resultCount = document.getElementById('result-count');
    const modulesContainer = document.querySelector('.modules-container');

    if (searchBox && difficultyFilter && resultCount && modulesContainer) {
        async function fetchModules() {
            const search = searchBox.value;
            const difficulty = difficultyFilter.value;
            const response = await fetch(`/modules?search=${search}&difficulty=${difficulty}`);
            const modules = await response.json();
            displayModules(modules);
        }

        function displayModules(modules) {
            modulesContainer.innerHTML = '';
            modules.forEach(module => {
                const card = document.createElement('div');
                card.classList.add('module-card');
                card.innerHTML = `<h3>${module.title}</h3><p>Difficulty: <strong>${module.difficulty}</p>`;
                card.addEventListener('click', () => handleModuleClick(module.slug));
                modulesContainer.appendChild(card);
            });
            resultCount.textContent = `${modules.length} results found`;
        }

        searchBox.addEventListener('input', fetchModules);
        difficultyFilter.addEventListener('change', fetchModules);

        fetchModules();
    }

    // Check if the signup form exists before adding the event listener
    const signupForm = document.getElementById('signup-form');
    const passwordInput = document.getElementById('password');

    if (signupForm) {
        const consentCheckbox = document.getElementById('consent-checkbox');
        const ageGroupDropdown = document.getElementById('age-group');

        // Enable/disable the age group dropdown based on consent checkbox
        if (consentCheckbox) {
            consentCheckbox.addEventListener('change', () => {
                ageGroupDropdown.disabled = !consentCheckbox.checked;
            });
        }

        passwordInput.addEventListener('input', checkUserPasswordStrength);

        signupForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const form = event.target;
            const signUpAs = form.signUpAs.value; // Learner or Tutor
            const username = signUpAs === 'learner' ? form.username.value : null; // Required for learners
            const email = form.email.value;
            const password = form.password.value;
            const consented = signUpAs === 'learner' ? consentCheckbox.checked : null;
            const ageGroup = consented ? ageGroupDropdown.value : null;

            if (!validateEmail(email)) {
                alert('Please enter a valid email address.');
                return;
            }

            if (!isPasswordStrong(password)) {
                alert('Password does not meet the requirements.');
                return;
            }

            // For learners, validate additional fields
            if (signUpAs === 'learner') {
                if (consented && !ageGroup) {
                    alert('Please select an age group.');
                    return;
                }
                if (!username) {
                    alert('Username is required for learners.');
                    return;
                }
            }

            // Prepare user data object
            const userData = {
                email,
                password,
                role: signUpAs
            };

            if (signUpAs === 'learner') {
                userData.username = username;
                userData.consented = consented;
                userData.ageGroup = consented ? ageGroup : null;
            }
            
            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
    
                if (response.ok) {
                    alert('Signup successful!');
                    window.location.href = '/login.html';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error during signup:', error);
                alert('An unexpected error occurred. Please try again later.');
            }
        });
    }
    
    
    // Login form handling
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
    
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
    
                const data = await response.json();
                if (response.ok) {
                    alert('Login successful!');
                    const role = data.role;
                    if (role === 'learner') {
                        window.location.replace('/learner-dashboard.html');
                    } else if (role === 'tutor') {
                        window.location.replace('/tutor-dashboard.html');
                    }
                } else {
                    document.getElementById('error-message').innerText = data.message || 'Login failed. Please try again.';
                }
            } catch (error) {
                console.error('Error during login:', error);
                document.getElementById('error-message').innerText = 'An error occurred during login. Please try again later.';
            }
        });
    }



    // Check login state for interactive activities
    checkLoginState().then(() => {
        const interactiveActivities = document.querySelectorAll('.activity');
        const loginPromptContainer = document.querySelector('.login-prompt-container');
        const loginPromptMessage = 'To access the fun activities, <a href="/login.html">login</a>.';

        fetch('/check-session', {
            method: 'GET',
            credentials: 'include' // Ensure cookies are sent with the request
        }).then(response => response.json()).then(data => {
            if (!data.loggedIn) {
                const loginPrompt = document.createElement('div');
                loginPrompt.classList.add('login-prompt');
                loginPrompt.innerHTML = loginPromptMessage;
                if (loginPromptContainer) {
                    loginPromptContainer.appendChild(loginPrompt);
                }
                interactiveActivities.forEach(activity => {
                    activity.style.pointerEvents = 'none';
                    activity.style.opacity = '0.5';
                });
            }
        }).catch(error => {
            console.error('Error checking session:', error);
        });
    }).catch(error => {
        console.error('Error checking login state:', error);
    });



    // Check if on learner dashboard
    const isOnLearnerDashboard = document.querySelector('.dashboard-container') !== null;
    const isOnTutorDashboard = document.querySelector('.dashboard-container') !== null;
    if(isOnLearnerDashboard || isOnTutorDashboard){
        // Fetch user data from the server
        const learnerData = await fetchUserData();

        if (learnerData) {
            document.getElementById('username').textContent = learnerData.username;
            document.getElementById('points-scored').textContent = learnerData.points;

            const modulesAnswered = learnerData.completedModules.map(module => `<li data-module-slug="${module.slug}">${module.title} (Points: ${module.pointsEarned} out of ${module.maxPoints})</li>`).join('');
            document.getElementById('modules-answered').innerHTML = modulesAnswered || '<li>You have yet to begin your journey comrade.</li>';

            const recommendedModules = learnerData.recommendedModules.map(module => `<li data-module-slug="${module.slug}">${module.title}</li>`).join('');
            document.getElementById('recommended-modules').innerHTML = recommendedModules;

            // Add event listeners to the module titles
            addModuleClickHandlers();
        }
    }



    // Menu icon
    const menuIcon = document.querySelector('.menu-icon');
    const closeIcon = document.querySelector('.close-icon');
    if(menuIcon) {
        menuIcon.addEventListener('click', toggleMenu);
        closeIcon.addEventListener('click', toggleMenu);
    }



    // Populate Spot the Phish activity
    if (document.querySelector("#spot-the-phish-container")) {
        populateSpotThePhishActivity();
    }
    // Populate Intro Quiz questions
    if (document.querySelector("#activity-intro-quiz")) {
        populateIntroQuiz();
    }


    // Populate Risk Mini-Game Activity
    if (document.querySelector("#risk-minigame-container")) {
        populateRiskMiniGameActivity();
    }
    // Populate Network Basics Quiz
    if (document.querySelector("#activity-network-basics-quiz")) {
        populateNetworkBasicsQuiz();
    }


    // Populate Advanced Malware Quiz
    if (document.querySelector("#activity-advanced-malware-quiz")) {
        populateAdvancedMalwareQuiz();
    }


    // Hide username field for tutors in manage account page
    if (window.location.pathname === '/manage-account.html') {
        const response = await fetch('/check-session', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const { role } = await response.json();

            // Hide the username field for tutors
            if (role === 'tutor') {
                const usernameLabel = document.getElementById('username-label');
                const usernameInput = document.getElementById('username');
                if (usernameLabel) usernameLabel.style.display = 'none';
                if (usernameInput) {
                    usernameInput.style.display = 'none';
                    usernameInput.removeAttribute('required'); // Remove requirement for username
                }
            }
        }
    }

    // Fetch and populate user info
    if (window.location.pathname === '/manage-account.html') {
        const response = await fetch('/account-info', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            const usernameField = document.getElementById('username');
            const emailField = document.getElementById('email');

            usernameField.value = data.username || '';
            emailField.value = data.email || '';
        } else {
            console.error('Failed to fetch account info:', response.statusText);
        }
    }

    // Update account info and handle no username for tutors
    const updateInfoBtn = document.getElementById('update-info-btn');
    // Ensure the button exists before attaching event listener
    if (updateInfoBtn) {
        updateInfoBtn.addEventListener('click', async () => {
            const response = await fetch('/check-session', {
                method: 'GET',
                credentials: 'include'
            });
        
            if (!response.ok) {
                alert('Failed to fetch user session.');
                return;
            }
        
            const { role } = await response.json();
            const email = document.getElementById('email').value.trim();
            const usernameInput = document.getElementById('username');
            const username = role === 'tutor' ? null : usernameInput?.value?.trim(); // Send null for tutors
        
            if (!validateEmail(email)) {
                alert('Invalid email format.');
                return;
            }
        
            // Validate username length for non-tutors
            if (role !== 'tutor' && (username.length < 3 || username.length > 20)) {
                alert('Username must be between 3 and 20 characters.');
                return;
            }
        
            const payload = {
                email,
                username // Always include username (null for tutors)
            };
        
            const updateResponse = await fetch('/update-account-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });
        
            if (updateResponse.ok) {
                alert('Information updated successfully!');
                location.reload();
            } else {
                const errorData = await updateResponse.json();
                console.error('Error updating account:', errorData.message);
                alert('Failed to update information.');
            }
        });    
    }  


});



// Function to set up the password toggle functionality
function setupPasswordToggle(toggleButtonId, eyeIconId, passwordInputId) {
    const toggleButton = document.getElementById(toggleButtonId);
    const eyeIcon = document.getElementById(eyeIconId);
    const passwordInput = document.getElementById(passwordInputId);

    if (!toggleButton || !eyeIcon || !passwordInput) return;

    toggleButton.addEventListener('click', () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        eyeIcon.classList.toggle("fa-eye", !isPassword);
        eyeIcon.classList.toggle("fa-eye-slash", isPassword);
    });
}

// Setup toggles only if elements exist
document.addEventListener("DOMContentLoaded", () => {
    const passwordToggles = [
        { toggle: 'togglePassword', icon: 'eyeIcon', input: 'password' },
        { toggle: 'togglePasswordCurrent', icon: 'eyeIconCurrent', input: 'current-password' },
        { toggle: 'togglePasswordNew', icon: 'eyeIconNew', input: 'new-password' },
        { toggle: 'togglePasswordConfirm', icon: 'eyeIconConfirm', input: 'confirm-password' }
    ];

    passwordToggles.forEach(({ toggle, icon, input }) => {
        setupPasswordToggle(toggle, icon, input);
    });
});



async function fetchUserData() {
    try {
        const response = await fetch('/user-data', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to fetch user data:', response.statusText);
            return {
                username: 'Guest',
                points: 0,
                completedModules: [],
                recommendedModules: []
            };
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching user data:', error);
        return {
            username: 'Guest',
            points: 0,
            completedModules: [],
            recommendedModules: []
        };
    }
}


function addModuleClickHandlers() {
    const modules = document.querySelectorAll('#modules-answered li, #recommended-modules li');
    modules.forEach(module => {
        const moduleSlug = module.dataset.moduleSlug;
        module.addEventListener('click', () => handleModuleClick(moduleSlug));
    });
}

// Function to handle module click event
async function handleModuleClick(moduleSlug) {
    // Check if module slug is defined
    if (!moduleSlug) { 
        console.error('Module slug is undefined');
        return;
    }

    try {
        // Fetch the session data to check if the user is logged in
        const sessionResponse = await fetch('/check-session', {
            method: 'GET',
            credentials: 'include'
        });

        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.loggedIn) {
                // If the user is logged in, check if the module has been completed and prompt for reset if necessary
                await checkAndOpenModule(moduleSlug, sessionData.role);
            } else {
                window.location.href = `/modules/${moduleSlug}.html`;  // Allow non-logged-in users to access module content
            }
        } else {
            console.error('Failed to check login state:', sessionResponse.statusText);
        }
    } catch (error) {
        console.error('Error handling module click:', error);
    }
}

// Checks if the module is completed and handles the reset option.
async function checkAndOpenModule(moduleSlug) {
    try {
        const response = await fetch(`/check-module-completion?moduleSlug=${moduleSlug}`);
        if (response.ok) {
            const data = await response.json();
            if (data.completed) {
                const reset = confirm("You have already completed this module. Would you like to reset the progress?");
                if (reset) {
                    await resetModuleProgress(moduleSlug);
                } else {
                    return;
                }
            }
            window.location.href = `/modules/${moduleSlug}.html`;
        } else {
            console.error('Failed to check module completion:', response.statusText);
        }
    } catch (error) {
        console.error('Failed to check module completion:', error);
    }
}

async function resetModuleProgress(moduleSlug) {
    try {
        const response = await fetch('/reset-module-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleSlug })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        alert('Module progress has been reset and points have been deducted. You can now access the module again.');
    } catch (error) {
        console.error('Failed to reset module progress:', error);
    }
}

// Password Strength Checker Activity
function checkPasswordStrength() {
    const password = document.getElementById('password-input').value;
    const strengthElement = document.getElementById('password-strength');
    const tips = '<br>Strong rememberable passwords are usually minimum 8 characters long' +
                 '<br>Include at least one uppercase letter [A - Z]' +
                 '<br>At least one number [0 - 9]' +
                 '<br>At least one special character [Ex: ! @ # $ % ^ & * ( ) - _ = + \\ | [ ] { } ; : / ? . >]';
    
    let strength = 'Weak';
    let message = '';

    if (password.length > 0) {
        if (password.length > 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
            strength = 'Strong';
            message = '<br>Good job Hackerman!';
        } else if (password.length > 6) {
            strength = 'Medium';
            message = tips;
        } else {
            message = tips;
        }
        strengthElement.innerHTML = `Password Strength: <strong style="color: #c237f9">${strength}</strong><br>${message}`;
    } else {
        strengthElement.innerHTML = '<strong>Please enter a password.</strong>';
    }
}



// Spot the Phish Activity Pool
const spotThePhishEmails = [
    { 
        id: 1, 
        subject: "Urgent! Update Your Account Information", 
        body: "Dear User,<br><br>We have detected unusual activity on your account. Please <a href='http://fake-link.com'>click here</a> to update your account information immediately.<br><br>Thank you, <br>Security Team", 
        type: "phish" 
    },
    { 
        id: 2, 
        subject: "Your Recent Purchase", 
        body: "Dear Customer,<br><br>Thank you for your recent purchase. Your order #12345 has been shipped and is on its way.<br><br>Thank you for shopping with us, <br>Customer Service", 
        type: "legit" 
    },
    { 
        id: 3, 
        subject: "Congratulations! You've Won a Prize", 
        body: "Dear User,<br><br>You've been selected as a winner in our latest contest. Please <a href='http://fake-link.com'>click here</a> to claim your prize.<br><br>Best regards, <br>The Contest Team", 
        type: "phish" 
    },
    { 
        id: 4, 
        subject: "Password Change Confirmation", 
        body: "Dear User,<br><br>Your password has been successfully changed. If you did not request this change, please contact our support team immediately.<br><br>Thank you, <br>Support Team", 
        type: "legit" 
    },
    { 
        id: 5, 
        subject: "Account Locked", 
        body: "Dear User,<br><br>Your account has been locked due to multiple failed login attempts. Please <a href='http://fake-link.com'>click here</a> to unlock your account.<br><br>Regards, <br>Security Team", 
        type: "phish" 
    },
    { 
        id: 6, 
        subject: "Your Subscription is Expiring Soon!", 
        body: "Dear User,<br><br>Your premium subscription is about to expire. Renew now to continue enjoying uninterrupted services.<br>Please <a href='http://fake-link.com'>click here</a> to renew your subscription.<br>Failure to act will result in the suspension of your account.<br><br>Regards, <br>Subscription Team", 
        type: "phish" 
    },
    { 
        id: 7, 
        subject: "You've Been Selected for an Exclusive Offer!", 
        body: "Dear Valued Customer,<br><br>You’ve been selected to receive an exclusive 90% discount on our premium services.<br>Don’t miss this once-in-a-lifetime opportunity! <a href='http://fake-link.com'>Click here</a> to claim your offer now.<br><br>Best regards, <br>Exclusive Deals Team", 
        type: "phish" 
    },
    { 
        id: 8, 
        subject: "Your Invoice is Ready", 
        body: "Dear Customer,<br><br>Your invoice for the recent purchase has been generated. Please find the details below:<br>Order ID: #67890<br>Total Amount: £45.00<br>You can <a href='https://legit-invoice.com'>view your invoice here</a>.<br><br>Thank you for choosing our service!<br><br>Regards, <br>Billing Team", 
        type: "legit" 
    },
    { 
        id: 9, 
        subject: "Unusual Login Detected on Your Account", 
        body: "Dear User,<br><br>We detected a login attempt from an unrecognised device. For your security, please <a href='http://fake-link.com'>verify your account</a> immediately.<br>Failure to act will result in account suspension.<br><br>Thank you, <br>Security Team", 
        type: "phish" 
    },
    { 
        id: 10, 
        subject: "Your Flight Confirmation", 
        body: "Dear [First Name],<br><br>Thank you for booking with us! Your flight details are as follows:<br>Flight Number: AB1234<br>Departure: 25th December, 10:00 AM<br>Arrival: 25th December, 1:00 PM<br><a href='https://legit-airline.com'>View your itinerary</a>.<br><br>Wishing you a pleasant journey!<br><br>Sincerely, <br>Airline Customer Service", 
        type: "legit" 
    },
];

// Function to randomly select questions
function getRandomItems(array, count) {
    const shuffledArray = array.slice();
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray.slice(0, count);
}

// Function to populate Spot the Phish activity
function populateSpotThePhishActivity() {
    const spotThePhishContainer = document.querySelector("#spot-the-phish-container");
    const selectedEmails = getRandomItems(spotThePhishEmails, 5);
    spotThePhishContainer.innerHTML = selectedEmails.map((email, index) => `
        <div class="email-example" id="email${email.id}">
            <h4>Email Example ${index + 1}</h4>
            <p>Subject: ${email.subject}</p>
            <p>${email.body}</p>
            <label><input type="radio" name="email${email.id}" value="phish"> Phishing Attempt</label>
            <label><input type="radio" name="email${email.id}" value="legit"> Legitimate</label>
        </div>
    `).join('');
}

// Function to check phishing answers
function checkSpotThePhishAnswers(button) {
    const selectedEmails = document.querySelectorAll(".email-example"); // Get all displayed email examples
    let score = 0;

    selectedEmails.forEach(emailExample => {
        const emailId = emailExample.id.replace('email', ''); // Extract email ID
        const correctType = spotThePhishEmails.find(email => email.id == emailId)?.type; // Get correct type from the pool

        // Check the user's answer
        const selectedAnswer = emailExample.querySelector(`input[name="email${emailId}"]:checked`);
        if (selectedAnswer && selectedAnswer.value === correctType) {
            score++;
        }
    });

    const difficulty = 'easy';
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById('phish-result');
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 5 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}



// Intro Quiz Pool
const introQuizQuestions = [
    { 
        id: 1, 
        question: "What should you look for in a URL to ensure a site is secure?", 
        options: ["http", "https", "www"], 
        answer: "https" 
    },
    { 
        id: 2, 
        question: "What is phishing?", 
        options: ["A type of fish", "Tricking you into revealing personal info", "A software update"], 
        answer: "Tricking you into revealing personal info" 
    },
    { 
        id: 3, 
        question: "Which password is the strongest?", 
        options: ["password123", "P@ssw0rd!", "123456"], 
        answer: "P@ssw0rd!" 
    },
    { 
        id: 4, 
        question: "What does the 's' in https stand for?", 
        options: ["Safe", "Secure", "Site"], 
        answer: "Secure" 
    },
    { 
        id: 5, 
        question: "Which of these is an example of malware?", 
        options: ["A pop-up advertisement", "A phishing email", "A computer virus"],
        answer: "A computer virus" 
    },
    { 
        id: 6, 
        question: "What is the recommended minimum length for a strong password?", 
        options: ["4 characters", "6 characters", "8 characters"], 
        answer: "8 characters" 
    }
];

// Function to populate the quizzes
function populateQuiz(containerId, quizPool, questionCount) {
    const container = document.querySelector(containerId);
    if (!container) return;

    const selectedQuestions = getRandomItems(quizPool, questionCount);

    container.innerHTML = selectedQuestions.map((question, index) => `
        <div class="quiz-question">
            <h4>${index + 1}. ${question.question}</h4>
            ${question.options.map(option => `
                <label><input type="radio" name="q${question.id}" value="${option}"> ${option}</label><br>
            `).join('')}
        </div>
    `).join('');
}

// Function to populate the intro module quiz
function populateIntroQuiz() {
    populateQuiz("#quiz-container", introQuizQuestions, 3);
}

// Function to check Intro quiz answers
function checkIntroQuizAnswers(button) {
    let score = 0;

    introQuizQuestions.forEach(question => {
        const selectedAnswer = document.querySelector(`input[name="q${question.id}"]:checked`);
        if (selectedAnswer && selectedAnswer.value === question.answer) {
            score++;
        }
    });

    const difficulty = 'easy';
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById('quiz-result');
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 3 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}



// Risk Mini-Game Scenario Pool
const riskMiniGameScenarios = [
    {
        id: 1,
        scenario: "Using public Wi-Fi at a café without a VPN. You connect to the free Wi-Fi to check your bank account.",
        isRisk: true
    },
    {
        id: 2,
        scenario: "Sharing your Wi-Fi password with a friend who needs internet access for a short period.",
        isRisk: true
    },
    {
        id: 3,
        scenario: "Not updating your router firmware for years because it's working fine and you don't see the need.",
        isRisk: true
    },
    {
        id: 4,
        scenario: "Using WPA3 encryption for your home Wi-Fi network.",
        isRisk: false
    },
    {
        id: 5,
        scenario: "Setting your Wi-Fi password to 'password123' for convenience.",
        isRisk: true
    },
    {
        id: 6,
        scenario: "Creating a unique and strong password for each of your online accounts and storing them in a password manager.",
        isRisk: false
    },
    {
        id: 7,
        scenario: "Leaving Bluetooth on in a crowded area, even when you're not using it.",
        isRisk: true
    },
    {
        id: 8,
        scenario: "Enabling two-factor authentication (2FA) for your email and banking accounts.",
        isRisk: false
    },
    {
        id: 9,
        scenario: "Clicking on a link in an email from an unknown sender claiming you've won a prize.",
        isRisk: true
    },
    {
        id: 10,
        scenario: "Using your device's built-in firewall and regularly checking for software updates.",
        isRisk: false
    }
]

// Function to populate the Risk Mini-Game with random scenarios
function populateRiskMiniGameActivity() {
    const riskMiniGameContainer = document.querySelector("#risk-minigame-container");
    const selectedScenarios = getRandomItems(riskMiniGameScenarios, 5);
    riskMiniGameContainer.innerHTML = selectedScenarios.map((scenario, index) => `
        <div class="risk-scenario">
            <h4>Risk Scenario ${index + 1}</h4>
            <p>${scenario.scenario}</p>
            <label><input type="radio" name="scenario${scenario.id}" value="true"> Risk</label>
            <label><input type="radio" name="scenario${scenario.id}" value="false"> Safe</label>
        </div>
    `).join('');
}

// Identify the Risk Mini-Game
function checkRiskMiniGameAnswers(button) {
    // Get all displayed scenarios from the DOM
    const displayedScenarios = document.querySelectorAll(".risk-scenario");
    let score = 0;

    // Loop through the displayed scenarios and check answers
    displayedScenarios.forEach(scenarioElement => {
        const scenarioId = scenarioElement.querySelector("input[name]").name.replace("scenario", "");
        const correctAnswer = riskMiniGameScenarios.find(scenario => scenario.id == scenarioId)?.isRisk; // Find the correct answer from the pool

        // Get the user's selected answer
        const selectedAnswer = scenarioElement.querySelector(`input[name="scenario${scenarioId}"]:checked`);
        if (selectedAnswer && selectedAnswer.value === String(correctAnswer)) {
            score++;
        }
    });

    const difficulty = 'medium';
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById('risk-result');
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 5 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}



// Wi-Fi Setup Simulator
function checkWiFiSetup() {
    const wifiName = document.getElementById('wifi-name').value;
    const wifiPassword = document.getElementById('wifi-password').value;
    const wifiEncryption = document.getElementById('wifi-encryption').value;
    const wifiGuest = document.getElementById('wifi-guest').checked;
    
    let message = '<strong style="color: #c237f9">Setup Results:</strong><br>';
    const isSecure = wifiName && wifiPassword && wifiEncryption !== "none" && wifiPassword.length >= 8;

    if (isSecure) {
        message += "Wi-Fi setup is secure.<br>";
    } else {
        message += "Wi-Fi setup is not secure.<br>Make sure to use a strong password and encryption.<br>";
    }

    if (wifiGuest) {
        message += "Guest network enabled.<br>";
    } else {
        message += "Guest network not enabled.<br>";
    }

    if (isSecure && wifiGuest) {
        message += '<br><strong style="color: #c237f9">WELL DONE COMRADE!</strong>';
    }

    document.getElementById('wifi-setup-result').innerHTML = message;
}



// Network Basics Quiz Questions Pool
const networkBasicsQuizQuestions = [
    { 
        id: 1, 
        question: "What is the primary purpose of network security?", 
        options: ["Allow everyone to access the network", "Ensure only the right people get in and keep out troublemakers", "Improve internet speed"], 
        answer: "Ensure only the right people get in and keep out troublemakers" 
    },
    { 
        id: 2, 
        question: "What does a DDoS attack do?", 
        options: ["Steals personal information", "Overloads a website or service to take it down", "Installs malware"], 
        answer: "Overloads a website or service to take it down" 
    },
    { 
        id: 3, 
        question: "Why should you use WPA3 encryption for your Wi-Fi?", 
        options: ["It's faster than other encryptions", "It's like having a super-strong lock on your digital door", "It's easier to remember"], 
        answer: "It's like having a super-strong lock on your digital door" 
    },
    { 
        id: 4, 
        question: "What is a man-in-the-middle attack?", 
        options: ["A hacker intercepts data being sent between two devices", "A hacker installs malware on a device", "A hacker creates a fake website"], 
        answer: "A hacker intercepts data being sent between two devices" 
    },
    { 
        id: 5, 
        question: "What should you be wary of when using public Wi-Fi?", 
        options: ["Low signal strength", "Hackers easily accessing the network", "Slow internet speed"], 
        answer: "Hackers easily accessing the network" 
    },
    { 
        id: 6, 
        question: "Which of the following is NOT a common network threat?", 
        options: ["Hackers and Cyber Attacks", "Slow Internet Speeds", "Man-in-the-Middle Attacks"], 
        answer: "Slow Internet Speeds" 
    },
    { 
        id: 7, 
        question: "What is the benefit of setting up a guest network for visitors?", 
        options: ["Improves internet speed", "Keeps your main network more secure", "Provides faster Wi-Fi for guests"], 
        answer: "Keeps your main network more secure" 
    },
    { 
        id: 8, 
        question: "What is the role of a firewall?", 
        options: ["To monitor and block suspicious traffic", "To speed up internet connection", "To encrypt your data"], 
        answer: "To monitor and block suspicious traffic" 
    },
    { 
        id: 9, 
        question: "Why is using a VPN beneficial?", 
        options: ["It increases internet speed", "It encrypts your data and hides your IP address", "It blocks ads on websites"], 
        answer: "It encrypts your data and hides your IP address" 
    },
    { 
        id: 10, 
        question: "What should you do if you notice strange devices connected to your network?", 
        options: ["Ignore it", "Check your network security settings", "Restart your router"], 
        answer: "Check your network security settings" 
    }
]

// Populate Network Basics Quiz
function populateNetworkBasicsQuiz() {
    populateQuiz("#quiz-container", networkBasicsQuizQuestions, 5); 
}

// Network Basics Quiz
function checkNetworkBasicsQuizAnswers(button) {
    let score = 0;

    networkBasicsQuizQuestions.forEach(question => {
        const selectedAnswer = document.querySelector(`input[name="q${question.id}"]:checked`);
        if (selectedAnswer && selectedAnswer.value === question.answer) {
            score++;
        }
    });

    const difficulty = 'medium';
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById('quiz-result');
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 5 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}



// Spot the Malware Activity Pool
const spotMalwarePool = [
    { name: "system.exe", cpu: "2%", memory: "100MB", suspicious: false },
    { name: "explorer.exe", cpu: "5%", memory: "200MB", suspicious: false },
    { name: "random.exe accessing system32", cpu: "80%", memory: "500MB", suspicious: true },
    { name: "svchost.exe", cpu: "1%", memory: "50MB", suspicious: false },
    { name: "malicious.exe sending data", cpu: "90%", memory: "800MB", suspicious: true },
    { name: "hidden.exe running in background", cpu: "70%", memory: "450MB", suspicious: true },
    { name: "trojan.exe listening on port", cpu: "60%", memory: "400MB", suspicious: true },
    { name: "legitimate.exe", cpu: "3%", memory: "120MB", suspicious: false },
    { name: "unusual_activity.exe", cpu: "85%", memory: "600MB", suspicious: true },
    { name: "update-service.exe", cpu: "2%", memory: "60MB", suspicious: false },
    { name: "unauthorized_access.exe", cpu: "95%", memory: "700MB", suspicious: true },
    { name: "idle.exe", cpu: "0%", memory: "20MB", suspicious: false }
];

function shuffleProcesses(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Load processes for Spot the Malware Activity
function loadProcesses() {
    const tableBody = document.getElementById("process-list");
    if (!tableBody) return;

    // Shuffle and select 6 processes
    const selectedProcesses = shuffleProcesses(spotMalwarePool).slice(0, 6);

    // Store displayed processes for evaluation
    sessionStorage.setItem("spotMalwareProcesses", JSON.stringify(selectedProcesses));

    // Clear existing rows
    tableBody.innerHTML = "";

    selectedProcesses.forEach((process, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${process.name}</td>
            <td>${process.cpu}</td>
            <td>${process.memory}</td>
            <td>
                <input type="checkbox" id="process-${index}" />
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Check user selections for Spot the Malware Activity
function evaluateMalwareSelection(button) {
    const tableBody = document.getElementById("process-list");
    if (!tableBody) return;

    // Retrieve displayed processes
    const displayedProcesses = JSON.parse(sessionStorage.getItem("spotMalwareProcesses")) || [];
    let correctSelections = 0;
    let correctAvoidances = 0;

    // Check user selections
    displayedProcesses.forEach((process, index) => {
        const checkbox = document.getElementById(`process-${index}`);
        if (checkbox) {
            if (checkbox.checked && process.suspicious) {
                correctSelections++;
            } else if (!checkbox.checked && !process.suspicious) {
                correctAvoidances++;
            }
        }
    });

    const score = correctSelections + correctAvoidances;
    const difficulty = "hard";
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById("spot-malware-result");

    resultElement.innerHTML = `
    You correctly identified <strong style="color: #c237f9">${correctSelections}</strong> suspicious processes 
    and avoided selecting <strong style="color: #c237f9">${correctAvoidances}</strong> non-suspicious processes.
    <br>Your total score: <strong style="color: #c237f9">${score}</strong>.
    <br>You earned <strong style="color: #c237f9">${points}</strong> points!
    `;
    resultElement.dataset.correctAnswers = score;

    // Lock the activity
    lockActivity();

    // Submit the activity points to the module
    submitActivity(button);
}

// Lock the Spot the Malware Activity after it has been submitted
function lockActivity() {
    const inputs = document.querySelectorAll("#process-list input, #spot-malware button");
    inputs.forEach(input => {
        input.disabled = true; // Disable inputs and buttons
    });

    const lockedMessage = document.createElement("p");
    lockedMessage.style.color = "#c237f9";
    lockedMessage.style.textAlign = "center";
    lockedMessage.style.fontWeight = "bold";
    lockedMessage.style.marginTop = "12px";
    const resultElement = document.getElementById("spot-malware-result");
    resultElement.insertAdjacentElement("afterend", lockedMessage);
}


document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("activity-spot-malware")) {
        loadProcesses();
    }
});



// Pool of Malware Defence Scenarios
const malwareDefenceScenarios = [
    { id: 1, scenario: "Your files are encrypted by ransomware.", correctAction: "disconnect" },
    { id: 2, scenario: "Your computer starts running slow and shows pop-ups.", correctAction: "antivirus" },
    { id: 3, scenario: "You notice unusual outbound network traffic.", correctAction: "disconnect" },
    { id: 4, scenario: "An email attachment installs unknown software.", correctAction: "antivirus" },
    { id: 5, scenario: "Your browser redirects to fake sites.", correctAction: "update" },
    { id: 6, scenario: "You receive a fake antivirus alert urging you to pay.", correctAction: "antivirus" },
    { id: 7, scenario: "Your webcam light turns on without your input.", correctAction: "disconnect" },
    { id: 8, scenario: "Your password manager warns of breached credentials.", correctAction: "update" },
    { id: 9, scenario: "Your sensitive files are being copied to an unknown server.", correctAction: "disconnect" },
    { id: 10, scenario: "You notice a fake software update prompt.", correctAction: "antivirus" }
];

// Function to shuffle and pick 5 random scenarios
function getRandomScenarios(pool, count) {
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Function to populate the malware defence activity
function populateMalwareDefenceActivity() {
    const activityContainer = document.querySelector("#malware-defence-container");
    if (!activityContainer) return; // Exit if the activity is not on the page

    const selectedScenarios = getRandomScenarios(malwareDefenceScenarios, 5);
    activityContainer.innerHTML = selectedScenarios.map((scenario, index) => `
        <div class="scenario" id="scenario-${scenario.id}">
            <p>${index + 1}. ${scenario.scenario}</p>
            <button onclick="handleDefenceChoice(${scenario.id}, 'update')">Update Software</button>
            <button onclick="handleDefenceChoice(${scenario.id}, 'disconnect')">Disconnect from Network</button>
            <button onclick="handleDefenceChoice(${scenario.id}, 'antivirus')">Run Antivirus</button>
        </div>
    `).join('');
    activityContainer.dataset.selectedScenarios = JSON.stringify(selectedScenarios);
}

// Function to handle choice for a specific scenario
function handleDefenceChoice(scenarioId, action) {
    const scenario = malwareDefenceScenarios.find(item => item.id === scenarioId);
    const scenarioElement = document.getElementById(`scenario-${scenarioId}`);
    const feedback = document.createElement("p");
    feedback.style.color = action === scenario.correctAction ? "green" : "red";
    feedback.textContent = action === scenario.correctAction
        ? "Correct! Good choice."
        : "Incorrect. Try to think critically.";
    scenarioElement.appendChild(feedback);

    // Disable buttons after one choice
    const buttons = scenarioElement.querySelectorAll("button");
    buttons.forEach(button => button.disabled = true);
}

// Function to check and tally answers
function checkMalwareDefenceAnswers(button) {
    const activityContainer = document.querySelector("#malware-defence-container");
    if (!activityContainer) return;

    const selectedScenarios = JSON.parse(activityContainer.dataset.selectedScenarios);
    let score = 0;

    selectedScenarios.forEach(scenario => {
        const scenarioElement = document.getElementById(`scenario-${scenario.id}`);
        const feedback = scenarioElement.querySelector("p:last-of-type");
        if (feedback && feedback.style.color === "green") {
            score++;
        }
    });

    const difficulty = "hard";
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById("malware-defence-result");
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 5 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}

// Ensure the script runs only on the correct page
document.addEventListener("DOMContentLoaded", () => {
    const activityElement = document.querySelector("#activity-malware-defence");
    if (activityElement) {
        populateMalwareDefenceActivity();
    }
});



// Advanced Malware Quiz Questions Pool
const advancedMalwareQuizQuestions = [
    {
        id: 1, 
        question: "What is Wireshark used for?", 
        options: ["Monitoring network traffic.", "Deleting suspicious files.", "Encrypting your data."], 
        answer: "Monitoring network traffic."
    },
    {
        id: 2,
        question: "What made the ILOVEYOU virus so effective?",
        options: ["It disguised itself as a love letter email.", "It could turn on webcams.", "It encrypted files for ransom."],
        answer: "It disguised itself as a love letter email."
    },
    {
        id: 3,
        question: "Which malware spreads quickly across a network without user intervention?",
        options: ["Trojan Horse", "Worm", "Spyware"],
        answer: "Worm"
    },
    {
        id: 4,
        question: "What’s the purpose of a sandbox in malware analysis?",
        options: ["To permanently delete malware.", "To safely observe malware behaviour.", "To create malware for testing."],
        answer: "To safely observe malware behaviour."
    },
    {
        id: 5,
        question: "What’s the main goal of spyware?",
        options: ["To gather your private information secretly.", "To display annoying pop-up ads.", "To slow down your computer."],
        answer: "To gather your private information secretly."
    },
    {
        id: 6,
        question: "What’s the most important rule for analysing malware?",
        options: ["Analyse malware in a controlled environment.", "Work directly on your personal computer.", "Share the malware with friends."],
        answer: "Analyse malware in a controlled environment."
    },
    {
        id: 7,
        question: "Which type of malware locks your files and demands payment?",
        options: ["Worm", "Ransomware", "Adware"],
        answer: "Ransomware"
    },
    {
        id: 8,
        question: "What’s the goal of static malware analysis?",
        options: ["To run the malware and observe its behaviour.", "To analyse malware without running it.", "To develop antivirus software."],
        answer: "To analyse malware without running it."
    },
    {
        id: 9,
        question: "How did Wannacry ransomware spread so quickly?",
        options: ["By attaching to phishing emails.", "By exploiting unpatched systems.", "Through app stores."],
        answer: "By exploiting unpatched systems."
    },
    {
        id: 10,
        question: "Which of these describes dynamic malware analysis?",
        options: ["Running malware on your computer for fun.", "Observing malware behaviour in a safe, controlled environment.", "Guessing what the malware does based on its name."],
        answer: "Observing malware behaviour in a safe, controlled environment."
    }
];

// Populate Advanced Malware Quiz
function populateAdvancedMalwareQuiz() {
    populateQuiz("#quiz-container", advancedMalwareQuizQuestions, 5); 
}

// Advanced Malware Quiz Check Answers
function checkAdvancedMalwareQuizAnswers(button) {
    let score = 0;

    advancedMalwareQuizQuestions.forEach(question => {
        const selectedAnswer = document.querySelector(`input[name="q${question.id}"]:checked`);
        if (selectedAnswer && selectedAnswer.value === question.answer) {
            score++;
        }
    });

    const difficulty = 'hard';
    const points = score * calculatePointsMultiplier(difficulty);
    const resultElement = document.getElementById('quiz-result');
    resultElement.innerHTML = `You got <strong style="color: #c237f9">${score}</strong> out of 5 correct.<br>You earned <strong style="color: #c237f9">${points}</strong> points!`;
    resultElement.dataset.correctAnswers = score;

    submitActivity(button);
}



// Sign up toggle based on user
function toggleRoleFields() {
    const role = document.getElementById('signup-as').value;
    const learnerFields = document.querySelectorAll('.learner-only');

    learnerFields.forEach(field => {
        field.style.display = role === 'learner' ? 'block' : 'none';
    });
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isPasswordStrong(password) {
    return password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
}

// Sign Up Password Strength Checker
function checkUserPasswordStrength() {
    const passwordInput = document.getElementById('password') || document.getElementById('new-password');
    const strengthElement = document.getElementById('password-strength');

    if (!passwordInput || !strengthElement) return;
    const password = passwordInput.value;

    let strength = 'Weak';
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
        strength = 'Strong';
    } 
    else if (password.length >= 6) {
        strength = 'Medium';
    }

    strengthElement.innerHTML = `Password Strength: <strong style="color: ${strength === 'Strong' ? '#4CAF50' : '#f44336'}">${strength}</strong>`;
}


// Attach event listener for logout button
function attachLogoutHandler() {
    const logoutButton = document.querySelector('#logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function() {
            try {
                const response = await fetch('/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    alert('Logout successful!');
                    window.location.href = '/';
                } else {
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                alert('An error occurred during logout. Please try again later.');
            }
        });
    }
}


let modulePoints = 0;
let maxModulePoints = 0;
let activityScores = {}; // Local storage for activity scores

async function submitActivity(button) {
    const activityElement = button.closest('.activity');
    const resultElement = activityElement.querySelector('p[id$="result"]');

    const correctAnswers = parseInt(resultElement.dataset.correctAnswers);
    const activityId = activityElement.dataset.id;
    const moduleSlug = activityElement.closest('[data-module-slug]').dataset.moduleSlug;
    const difficulty = activityElement.dataset.difficulty;
    const points = correctAnswers * calculatePointsMultiplier(difficulty);

    // Ensure moduleSlug and points are defined
    if (!moduleSlug || points == null) {
        console.error('Missing moduleSlug or points', { moduleSlug, points });
        alert('Failed to submit activity: Missing module data.');
        return;
    }

    // Check if this activity has already been submitted
    if (activityScores[activityId]) {
        alert('This activity has already been submitted.');
        return;
    }

    // Store the score
    activityScores[activityId] = points;
    modulePoints += points;
    
    // Disable the button and lock inputs
    button.disabled = true;
    const inputs = activityElement.querySelectorAll('input, button');
    inputs.forEach(input => {
        input.disabled = true; // Disable all input fields and buttons
    });

    // Display locked message
    const lockedMessage = document.createElement('p');
    lockedMessage.style.color = '#c237f9'; 
    lockedMessage.style.textAlign = 'center';
    lockedMessage.style.fontWeight = 'bold';
    lockedMessage.style.marginTop = '0px';
    lockedMessage.textContent = "Score’s locked—time to crush the next one!";
    resultElement.insertAdjacentElement('afterend', lockedMessage);

    // Fetch the module to get the maxPoints value
    try {
        const moduleResponse = await fetch(`/modules?slug=${moduleSlug}`);
        if (moduleResponse.ok) {
            const moduleData = await moduleResponse.json();
            maxModulePoints = moduleData.maxPoints; // Ensure you access the first element if the response is an array
        } else {
            console.error('Failed to fetch module data:', moduleResponse.statusText);
            return;
        }
    } catch (error) {
        console.error('Failed to fetch module data:', error);
        return;
    }

    const isFinalSubmit = button.classList.contains('final-submit');

    if (isFinalSubmit) {
        try {
            // Complete the module
            const completeResponse = await fetch('/complete-module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleSlug, score: modulePoints })
            });

            if (!completeResponse.ok) {
                console.error('Failed to complete module:', completeResponse.statusText);
                throw new Error(`HTTP error! status: ${completeResponse.status}`);
            }

            const completeData = await completeResponse.json();

            // Extract percentile and maxPoints
            const { maxPoints, percentile } = completeData;

            alert(`Congratulations! You've completed the module.\n\nTotal Points earned: ${modulePoints} out of ${maxPoints}\nPerformance: ${percentile || "Not calculated"}`);
            modulePoints = 0; // Reset for next module
            maxModulePoints = 0; // Reset for next module
            activityScores = {}; // Reset activity scores
            window.location.href = '/search-modules.html';
        } catch (error) {
            console.error('Failed to complete module:', error);
        }
    }
}


// Function to continue to modules page
function continueToModules() {
    window.location.href = '/search-modules.html';
}


// Function to calculate points multiplier based on difficulty
function calculatePointsMultiplier(difficulty) {
    switch (difficulty) {
        case 'easy': return 1;
        case 'medium': return 2;
        case 'hard': return 3;
        default: return 0;
    }
}


// Check if the module is completed and handle reset option
async function checkModuleCompletion(moduleSlug) {
    try {
        const response = await fetch(`/check-module-completion?moduleSlug=${moduleSlug}`);
        if (response.ok) {
            const data = await response.json();
            if (data.completed) {
                const reset = confirm("You have already completed this module. Would you like to reset the progress?");
                if (reset) {
                    await resetModuleProgress(moduleSlug);
                } else {
                    window.location.href = '/search-modules.html';
                }
            }
        } else {
            console.error('Failed to check module completion:', response.statusText);
        }
    } catch (error) {
        console.error('Error checking module completion:', error);
    }
}


// Function to update leaderboard
async function updateLeaderboard() {
    try {
        const response = await fetch('/leaderboard-data', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const leaderboard = await response.json();
            const leaderboardBody = document.getElementById('leaderboard-body');
            leaderboardBody.innerHTML = '';

            leaderboard.slice(0, 15).forEach((user, index) => {
                const row = document.createElement('tr');
                if (index === 0) row.classList.add('top1');
                else if (index === 1) row.classList.add('top2');
                else if (index === 2) row.classList.add('top3');

                row.innerHTML = `<td>${user.username}</td><td>${user.points}</td>`;
                leaderboardBody.appendChild(row);
            });
        } else {
            console.error('Failed to fetch leaderboard data:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
    }
}



// Account management handlers
document.addEventListener("DOMContentLoaded", () => {
    const resetPasswordBtn = document.getElementById("reset-password-btn");
    const deleteAccountBtn = document.getElementById("delete-account-btn");

    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener("click", async () => {
            const currentPassword = document.getElementById("current-password").value;
            const newPassword = document.getElementById("new-password").value;
            const confirmPassword = document.getElementById("confirm-password").value;
    
            if (newPassword !== confirmPassword) {
                alert("New password and confirm password do not match.");
                return;
            }
    
            const response = await fetch('/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
    
            if (response.ok) {
                alert("Password updated successfully!");
                location.reload();
            } else {
                alert("Error updating password.");
            }
        });
    }
    
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete your account?\nThis action cannot be undone.")) {
                return;
            }
    
            const response = await fetch('/delete-account', { method: 'DELETE' });
    
            if (response.ok) {
                alert("Account deleted successfully.");
                window.location.href = "/";
            } else {
                alert("Error deleting account.");
            }
        });
    }
    
});



// Tutor learner handling
document.addEventListener('DOMContentLoaded', () => {
    loadClassList();

    const addLearnerBtn = document.getElementById('add-learner-btn');
    if (addLearnerBtn) {
        addLearnerBtn.addEventListener('click', openAddLearnerPopup);
    }

    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAddLearnerPopup);
    }

    const addLearnerForm = document.getElementById('add-learner-form');
    if (addLearnerForm) {
        addLearnerForm.addEventListener('submit', addLearner);
    }

    // Add generate report button functionality
    function addGenerateReportButton(parentElement, userId) {
        const generateReportBtn = document.createElement('button');
        generateReportBtn.classList.add('generate-report-btn', 'btn');
        generateReportBtn.textContent = 'Generate Report';
        if(generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                window.location.href = `/generate-report?userId=${userId}`;
            });
        }
        parentElement.appendChild(generateReportBtn);
    }

    async function loadClassList() {
        const response = await fetch('/get-learners', { credentials: 'include' });
        const data = await response.json();
        const classList = document.getElementById('class-list');
        if (classList) {
            classList.innerHTML = '';

            data.learners.forEach(learner => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="#" onclick="fetchLearnerProgress('${learner.id}', '${learner.username}')">${learner.username}</a></td>
                    <td>${learner.points}</td>
                    <td class="actions"></td>
                `;

                const actionsCell = row.querySelector('.actions');
                addGenerateReportButton(actionsCell, learner.id);

                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-learner-btn', 'btn');
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', () => deleteLearner(learner.id));
                actionsCell.appendChild(deleteBtn);

                classList.appendChild(row);
            });
        }
    }
});

let learnerToDelete = null;

function openAddLearnerPopup() {
    const popup = document.getElementById('add-learner-popup');
    if (popup) {
        popup.style.display = 'flex';
    }
}

function closeAddLearnerPopup() {
    const popup = document.getElementById('add-learner-popup');
    if (popup) {
        popup.style.display = 'none';
    }
}

async function addLearner(event) {
    event.preventDefault();
    const email = document.getElementById('learner-email').value;

    const response = await fetch('/add-learner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (response.ok) {
        // Display toast notification
        const learnerAddedToast = document.getElementById('learner-added-toast');
        const learnerAddedToastContent = document.getElementById('learner-added-toast-content');
        learnerAddedToastContent.textContent = 'Learner added successfully!';
        learnerAddedToast.style.display = 'block';

        // Close popup
        closeAddLearnerPopup();

        // Auto-hide toast notification after 2 seconds
        setTimeout(() => {
            learnerAddedToast.style.display = 'none';
        }, 1500);

        // Refresh page to update list on dashboard
        setTimeout(() => {
            window.location.reload();
        }, 1500); // wait for 1.5 seconds to ensure popup is closed
    } else {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = data.message;
        }
    }
}

async function deleteLearner(learnerId) {
    if (confirm("Are you sure you want to delete this learner?")) {
        const response = await fetch('/delete-learner', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: learnerId })
        });

        if (response.ok) {
            // Refresh page to update list on dashboard
            location.reload(true);
        } else {
            console.error('Failed to delete learner');
        }
    }
}

async function fetchLearnerProgress(userId, username) {
    try {
        console.log(`Fetching progress for userId: ${userId}`); // Add logging
        const response = await fetch(`/get-learner-progress?id=${userId}`);

        if (!response.ok) {
            throw new Error('Failed to fetch progress.');
        }

        const data = await response.json();
        console.log('Progress data fetched:', data); // Log fetched data

        const progressList = document.getElementById('progress-list');
        const learnerProgress = document.getElementById('learner-progress');

        if (progressList && learnerProgress) {
            if (data.modules.length > 0) {
                progressList.innerHTML = data.modules
                    .map(module => `<li>${module.title} (Points: ${module.points} out of ${module.maxPoints})</li><br>`)
                    .join('');
            } else {
                progressList.innerHTML = '<li>No completed modules yet.</li>';
            }

            learnerProgress.querySelector('p').innerHTML = `<h3 style="color: #c237f9">${username}:</h3>`;
        }
    } catch (error) {
        console.error('Error fetching progress:', error);

        const progressList = document.getElementById('progress-list');
        if (progressList) {
            progressList.innerHTML = '<li>Error fetching progress. Please try again later.</li>';
        }
    }
}

const generateReportBtn = document.getElementById('generate-report-btn');
if (generateReportBtn) {
  generateReportBtn.addEventListener('click', () => {
    fetch('/generate-report')
        .then(response => {
            if (response.status === 200) {
                response.blob().then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `User_Report_${Date.now()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                });
            } else {
                alert('Failed to generate report. Please try again.');
            }
        })
        .catch(error => console.error('Error generating report:', error));
  });
}