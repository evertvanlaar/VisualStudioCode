// ============================================
// PelionRent - JavaScript Application
// ============================================

// Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const navbarMenu = document.querySelector('.navbar-menu');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navbarMenu.style.display = navbarMenu.style.display === 'flex' ? 'none' : 'flex';
    });
}

// Close menu when a link is clicked
document.querySelectorAll('.navbar-menu a').forEach(link => {
    link.addEventListener('click', () => {
        if (navbarMenu) {
            navbarMenu.style.display = 'none';
        }
    });
});

// Bike Reserve Button - Pre-fill form
document.querySelectorAll('.bike-reserve').forEach(button => {
    button.addEventListener('click', (e) => {
        const bikeName = e.target.dataset.bike;
        document.getElementById('bikeType').value = bikeName;
        document.getElementById('bikeType').focus();
        
        // Smooth scroll to reservation form
        document.getElementById('reserve').scrollIntoView({ behavior: 'smooth' });
    });
});

// Form Validation
const reservationForm = document.getElementById('reservationForm');
const successMessage = document.getElementById('successMessage');

// Validation rules
const validationRules = {
    fullName: {
        validate: (value) => value.trim().length >= 2,
        message: 'Please enter a valid name (at least 2 characters)'
    },
    email: {
        validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Please enter a valid email address'
    },
    phone: {
        validate: (value) => /^[\d\s\-\+\(\)]{7,20}$/.test(value),
        message: 'Please enter a valid phone number'
    },
    bikeType: {
        validate: (value) => value.length > 0,
        message: 'Please select a bike type'
    },
    rentalDate: {
        validate: (value) => {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return selectedDate >= today;
        },
        message: 'Please select a valid future date'
    },
    days: {
        validate: (value) => parseInt(value) > 0 && parseInt(value) <= 30,
        message: 'Please enter a number between 1 and 30 days'
    },
    terms: {
        validate: (value) => value === true,
        message: 'You must agree to the terms and conditions'
    }
};

// Display error message
function showError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

// Clear error message
function clearError(fieldName) {
    const errorElement = document.getElementById(`${fieldName}Error`);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

// Validate single field
function validateField(fieldName) {
    const field = document.getElementById(fieldName);
    if (!field) return true;

    let value = field.value;
    if (fieldName === 'terms') {
        value = field.checked;
    }

    const rule = validationRules[fieldName];
    if (!rule) return true;

    if (!rule.validate(value)) {
        showError(fieldName, rule.message);
        return false;
    } else {
        clearError(fieldName);
        return true;
    }
}

// Real-time validation on input
Object.keys(validationRules).forEach(fieldName => {
    const field = document.getElementById(fieldName);
    if (field) {
        const eventType = fieldName === 'terms' ? 'change' : 'blur';
        field.addEventListener(eventType, () => validateField(fieldName));
    }
});

// Form submission
if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate all fields
        let isValid = true;
        Object.keys(validationRules).forEach(fieldName => {
            if (!validateField(fieldName)) {
                isValid = false;
            }
        });

        if (isValid) {
            // Collect form data
            const formData = {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                bikeType: document.getElementById('bikeType').value,
                rentalDate: document.getElementById('rentalDate').value,
                days: document.getElementById('days').value,
                notes: document.getElementById('notes').value,
                timestamp: new Date().toISOString()
            };

            // Store in localStorage (for demo purposes)
            let reservations = JSON.parse(localStorage.getItem('pelionrentReservations')) || [];
            reservations.push(formData);
            localStorage.setItem('pelionrentReservations', JSON.stringify(reservations));

            // Show success message
            successMessage.style.display = 'block';
            
            // Reset form
            reservationForm.reset();

            // Hide success message after 5 seconds
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 5000);

            // Log to console for demonstration
            console.log('Reservation submitted:', formData);
        }
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Add animation to elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe bike cards and review cards
document.querySelectorAll('.bike-card, .review-card, .pricing-card, .about-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
});

// Update minimum date for rental date input
const rentalDateInput = document.getElementById('rentalDate');
if (rentalDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    rentalDateInput.min = `${yyyy}-${mm}-${dd}`;
}

// Initialize
console.log('PelionRent application loaded successfully');
