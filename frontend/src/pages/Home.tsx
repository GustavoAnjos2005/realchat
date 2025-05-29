import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-2 h-2 bg-white rounded-full"></div>
        <div className="absolute top-20 right-20 w-2 h-2 bg-white rounded-full"></div>
        <div className="absolute bottom-20 left-20 w-2 h-2 bg-white rounded-full"></div>
        <div className="absolute top-1/3 left-1/4 w-1 h-1 bg-white rounded-full"></div>
        <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-white rounded-full"></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto text-center text-white">
          {/* Hero Section */}
          <div className="mb-16 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium text-white/90 mb-6 border border-white/20">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              Conecte-se agora mesmo
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-white via-red-200 to-white bg-clip-text text-transparent leading-tight">
              Chat Inteligente
              <span className="block text-red-300">em Tempo Real</span>
            </h1>
            
            <p className="text-lg sm:text-xl lg:text-2xl mb-10 sm:mb-12 px-4 sm:px-0 text-white/80 max-w-3xl mx-auto leading-relaxed">
              Experimente conversas revolucionárias com IA avançada. 
              Conecte-se, compartilhe e descubra uma nova dimensão de comunicação digital.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center mb-16">
              <Link 
                to="/signup" 
                className="group w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-8 sm:px-10 py-4 rounded-2xl font-semibold transition-all duration-300 text-white text-center shadow-lg hover:shadow-red-500/25 hover:scale-105 transform"
              >
                <span className="flex items-center justify-center gap-2">
                  Começar Gratuitamente
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link 
                to="/login" 
                className="group w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 sm:px-10 py-4 rounded-2xl font-semibold transition-all duration-300 text-center hover:scale-105 transform"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Já tenho conta
                </span>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
            <div className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 transform">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-white">Chat Instantâneo</h3>
              <p className="text-white/70 leading-relaxed">
                Mensagens em tempo real com interface fluida e responsiva para todas as plataformas.
              </p>
            </div>

            <div className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 transform">
              <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-white">IA Avançada</h3>
              <p className="text-white/70 leading-relaxed">
                Respostas inteligentes e contextuais que enriquecem suas conversas com tecnologia de ponta.
              </p>
            </div>

            <div className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 transform md:col-span-3 lg:col-span-1">
              <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-orange-500 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-white">Seguro & Privado</h3>
              <p className="text-white/70 leading-relaxed">
                Suas conversas protegidas com criptografia avançada e controle total de privacidade.
              </p>
            </div>
          </div>

          {/* How it Works Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 sm:p-12 border border-white/10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-8 sm:mb-12 bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent">
              Como Funciona
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {[
                { 
                  step: "1", 
                  title: "Registre-se", 
                  description: "Crie sua conta em segundos com nosso processo simplificado",
                  icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                },
                { 
                  step: "2", 
                  title: "Personalize", 
                  description: "Configure seu perfil e preferências de tema",
                  icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                },
                { 
                  step: "3", 
                  title: "Conecte-se", 
                  description: "Encontre usuários online e inicie conversas interessantes",
                  icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                },
                { 
                  step: "4", 
                  title: "Explore IA", 
                  description: "Experimente conversas enriquecidas com inteligência artificial",
                  icon: "M13 10V3L4 14h7v7l9-11h-7z"
                }
              ].map((item, index) => (
                <div key={index} className="text-center group">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-600 rounded-full flex items-center justify-center font-bold text-sm border-2 border-red-200">
                      {item.step}
                    </div>
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold mb-3 text-white">{item.title}</h4>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}