// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const checkUsermavenLoaded = () => {
        const usermaven = (window as any).usermaven;

        if (!usermaven) {
            console.log('Usermaven SDK not loaded yet, retrying in 100ms');
            setTimeout(checkUsermavenLoaded, 100);
            return;
        }

        console.log('Usermaven SDK loaded successfully');

        // Test track event
        document.getElementById('trackEvent')?.addEventListener('click', () => {
            usermaven.track('button_click', { buttonId: 'trackEvent' });
            console.log('Track event sent');
        });

        // Test identify user
        document.getElementById('identifyUser')?.addEventListener('click', () => {
            usermaven.identify({ id: 'user123', email: 'test@example.com' });
            console.log('User identified');
        });

        console.log('Usermaven SDK test script loaded');
    };

    checkUsermavenLoaded();
});
