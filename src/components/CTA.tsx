
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

const CTA = () => {
  return (
    <section className="bg-gradient-to-r from-blue-600 to-indigo-800 py-16">
      <div className="isko-container">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Find Your Perfect Scholarship?</h2>
          <p className="text-lg mb-8 opacity-90">
            Start chatting with IskoChatAI today and take the first step toward funding your education.
          </p>
          <Button size="lg" className="isko-button-secondary">
            <MessageCircle className="w-5 h-5 mr-2" />
            Chat with Isko Now
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
