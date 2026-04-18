// ============================================
// frontend.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ
// ============================================
(function() {
  const BACKEND_BASE_URL = 'https://diastargets-2.onrender.com'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ URL
  
  let currentBackendUrl = BACKEND_BASE_URL;
  let configLoaded = false;

  async function loadConfig() {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const config = await response.json();
        if (config.backend_url) {
          currentBackendUrl = config.backend_url;
        } else {
          currentBackendUrl = BACKEND_BASE_URL;
        }
        configLoaded = true;
        console.log('Config loaded:', currentBackendUrl);
      } else {
        currentBackendUrl = BACKEND_BASE_URL;
        configLoaded = true;
        console.log('Using fallback URL:', currentBackendUrl);
      }
    } catch (error) {
      console.error('Config load error, using fallback:', error);
      currentBackendUrl = BACKEND_BASE_URL;
      configLoaded = true;
    }
  }

  async function submitForm(payload) {
    if (!configLoaded) {
      await loadConfig();
    }
    
    try {
      const response = await fetch(`${currentBackendUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Submit failed');
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Submit error:', error);
      return { success: false, error: error.message };
    }
  }

  window.submitLeadForm = async function(formElement) {
    const formData = new FormData(formElement);
    const payload = {
      type: 'lead',
      name: formData.get('name'),
      phone: formData.get('phone'),
      source: formData.get('source') || 'сайт',
      lang: formData.get('lang') || 'ru',
      utm: {}
    };
    
    const result = await submitForm(payload);
    
    if (result.success) {
      alert('✅ Заявка отправлена! Мы свяжемся с вами.');
      formElement.reset();
    } else {
      alert('❌ Ошибка: ' + result.error + '. Попробуйте позже.');
    }
    
    return result.success;
  };

  window.submitPaymentForm = async function(formElement) {
    const formData = new FormData(formElement);
    const payload = {
      type: 'payment',
      name: formData.get('name'),
      phone: formData.get('phone'),
      plan: formData.get('plan'),
      method: formData.get('method'),
      source: formData.get('source') || 'сайт',
      lang: formData.get('lang') || 'ru',
      utm: {}
    };
    
    const result = await submitForm(payload);
    
    if (result.success) {
      alert('✅ Заявка на оплату принята!');
      formElement.reset();
    } else {
      alert('❌ Ошибка: ' + result.error);
    }
    
    return result.success;
  };

  window.submitReviewForm = async function(formElement) {
    const formData = new FormData(formElement);
    const payload = {
      type: 'review',
      name: formData.get('name'),
      text: formData.get('text'),
      rating: parseInt(formData.get('rating')) || 5,
      lang: formData.get('lang') || 'ru'
    };
    
    const result = await submitForm(payload);
    
    if (result.success) {
      alert('✅ Спасибо за отзыв!');
      formElement.reset();
    } else {
      alert('❌ Ошибка: ' + result.error);
    }
    
    return result.success;
  };

  window.submitQuizForm = async function(formElement) {
    const formData = new FormData(formElement);
    const payload = {
      type: 'quiz',
      name: formData.get('name'),
      phone: formData.get('phone'),
      business: formData.get('business') || '',
      budget: formData.get('budget') || '',
      request: formData.get('request') || '',
      hasSales: formData.get('hasSales') || '',
      source: 'квиз',
      lang: formData.get('lang') || 'ru',
      utm: {}
    };
    
    const result = await submitForm(payload);
    
    if (result.success) {
      alert('✅ Заявка отправлена! Мы свяжемся с вами для консультации.');
      formElement.reset();
      
      if (window.onQuizSuccess) {
        window.onQuizSuccess();
      }
    } else {
      alert('❌ Ошибка: ' + result.error);
    }
    
    return result.success;
  };

  window.bookCall = async function(userData) {
    if (!userData || !userData.name || !userData.phone) {
      alert('❌ Пожалуйста, укажите имя и телефон');
      return false;
    }
    
    const payload = {
      type: 'quiz',
      name: userData.name,
      phone: userData.phone,
      business: userData.business || '',
      budget: userData.budget || '',
      request: 'Запись на созвон',
      hasSales: userData.hasSales || '',
      source: 'созвон',
      lang: 'ru',
      utm: {}
    };
    
    const result = await submitForm(payload);
    
    if (result.success) {
      alert('✅ Заявка на созвон отправлена! Мы свяжемся с вами в течение 15 минут.');
      return true;
    } else {
      alert('❌ Ошибка: ' + result.error + '. Пожалуйста, попробуйте еще раз или свяжитесь с нами по телефону.');
      return false;
    }
  };
  window.openQuiz = function () {
  const modal = document.getElementById('quiz-modal');

  if (modal) {
    modal.classList.add('open');
    return;
  }

  const quizBlock =
    document.getElementById('quiz') ||
    document.querySelector('.quiz-wrap') ||
    document.querySelector('form[data-type="quiz"]');

  if (quizBlock) {
    quizBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  alert('Квиз не найден');
};

  loadConfig();
  
  document.addEventListener('DOMContentLoaded', function() {
    const leadForms = document.querySelectorAll('form[data-type="lead"]');
    leadForms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.submitLeadForm(form);
      });
    });
    
    const paymentForms = document.querySelectorAll('form[data-type="payment"]');
    paymentForms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.submitPaymentForm(form);
      });
    });
    
    const reviewForms = document.querySelectorAll('form[data-type="review"]');
    reviewForms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.submitReviewForm(form);
      });
    });
    
    const quizForms = document.querySelectorAll('form[data-type="quiz"]');
    quizForms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.submitQuizForm(form);
      });
    });
    
    const callButtons = document.querySelectorAll('[data-action="book-call"]');
    callButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const userData = {
          name: button.getAttribute('data-name') || '',
          phone: button.getAttribute('data-phone') || '',
          business: button.getAttribute('data-business') || '',
          hasSales: button.getAttribute('data-hasSales') || ''
        };
        await window.bookCall(userData);
      });
    });
    
    console.log('✅ Forms initialized');
  });
})();
