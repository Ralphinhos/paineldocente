import { useState, useEffect, useCallback, useRef } from 'react';

const IDLE_CHECK_KEY = 'sessionExpireTime'; // Chave para o localStorage

const useIdleTimer = (timeout: number, onIdle: () => void) => {
  const [isIdle, setIsIdle] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true); // Ref para rastrear se o componente está montado

  // Função para verificar e forçar o logout se o tempo de expiração no localStorage passou
  const checkStoredExpiration = useCallback(() => {
    const expirationTime = localStorage.getItem(IDLE_CHECK_KEY);
    if (expirationTime && Date.now() > parseInt(expirationTime, 10)) {
      if (isMounted.current) { // Só atualiza estado se montado
        setIsIdle(true);
      }
      onIdle(); // Chama a função de logout/idle
      return true; // Expirado
    }
    return false; // Não expirado ou não existe
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (isMounted.current) { // Só atualiza estado se montado
      setIsIdle(false);
    }
    // Define o novo tempo de expiração no localStorage
    localStorage.setItem(IDLE_CHECK_KEY, (Date.now() + timeout).toString());
    
    // Agenda o próximo onIdle
    timer.current = setTimeout(() => {
      if (isMounted.current) { // Só atualiza estado se montado
        setIsIdle(true);
      }
      onIdle();
    }, timeout);
  }, [timeout, onIdle]);

  const handleActivity = useCallback(() => {
    // Se a atividade ocorrer, mas a verificação de expiração já deveria ter deslogado,
    // não resete o timer. Deixe o onIdle da expiração (que já foi chamado ou será chamado por checkStoredExpiration) ocorrer.
    if (document.visibilityState === 'hidden') { // Não reseta se a aba não estiver visível
        return;
    }
    if (checkStoredExpiration()) return; 
    resetTimer();
  }, [resetTimer, checkStoredExpiration]);

  useEffect(() => {
    isMounted.current = true;

    // Verificar expiração ao montar o componente / carregar a página
    if (checkStoredExpiration()) {
      return; // Se já expirou e onIdle foi chamado, não precisa fazer mais nada aqui.
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'
    ];
    
    // Configura o timer inicial (após a verificação de expiração)
    resetTimer();

    // Adiciona event listeners para cada evento de atividade
    // Estes listeners chamam handleActivity, que por sua vez chama checkStoredExpiration e resetTimer
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Função de limpeza
    return () => {
      isMounted.current = false; // Marca como desmontado
      if (timer.current) {
        clearTimeout(timer.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      // Não limpamos o IDLE_CHECK_KEY do localStorage aqui, 
      // pois ele precisa persistir se a aba for fechada.
    };
  }, [resetTimer, handleActivity, checkStoredExpiration]); // Incluído checkStoredExpiration

  // Listener adicional para 'visibilitychange'
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Quando a aba se torna visível, verifica a expiração.
        // Se não expirou, handleActivity (se houver) ou o timer existente continuarão.
        // Se expirou, checkStoredExpiration chamará onIdle.
        checkStoredExpiration();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Limpeza para este listener específico
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStoredExpiration]); // A dependência é apenas checkStoredExpiration

  return isIdle; // Retorna o estado de ociosidade (pode ser usado para UI, mas o logout é por onIdle)
};

export default useIdleTimer;
