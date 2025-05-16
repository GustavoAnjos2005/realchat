import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h1 className="text-5xl font-bold mb-8">Chat em Tempo Real com IA</h1>
          <p className="text-xl mb-12">
            Uma plataforma moderna de chat que combina comunicação em tempo real 
            com respostas inteligentes. Conecte-se com outros usuários e 
            experimente uma nova forma de interação.
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Chat em Tempo Real</h3>
                <p>
                  Comunique-se instantaneamente com outros usuários através de 
                  nossa interface intuitiva e responsiva.
                </p>
              </div>

              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Integração com IA</h3>
                <p>
                  Receba respostas inteligentes e contextuais para suas mensagens,
                  tornando as conversas mais produtivas.
                </p>
              </div>

              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Fácil de Usar</h3>
                <p>
                  Interface moderna e amigável, projetada para proporcionar a 
                  melhor experiência de usuário possível.
                </p>
              </div>
            </div>

            <div className="space-x-4">
              <Link 
                to="/signup" 
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Criar Conta
              </Link>
              <Link 
                to="/login" 
                className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
              >
                Entrar
              </Link>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8">Como Funciona</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <div className="text-3xl mb-4">1</div>
                <h4 className="text-lg font-semibold mb-2">Crie sua conta</h4>
                <p>Registre-se gratuitamente em apenas alguns segundos</p>
              </div>

              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <div className="text-3xl mb-4">2</div>
                <h4 className="text-lg font-semibold mb-2">Conecte-se</h4>
                <p>Entre na plataforma com suas credenciais</p>
              </div>

              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <div className="text-3xl mb-4">3</div>
                <h4 className="text-lg font-semibold mb-2">Inicie conversas</h4>
                <p>Encontre usuários online e comece a conversar</p>
              </div>

              <div className="bg-white bg-opacity-10 p-6 rounded-lg">
                <div className="text-3xl mb-4">4</div>
                <h4 className="text-lg font-semibold mb-2">Interaja com IA</h4>
                <p>Aproveite as respostas inteligentes em suas conversas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}