import { forwardRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { useSnackbar } from '../context/SnackbarContext';

// Use Material UI's default Alert component without any custom theming
const Alert = forwardRef(function Alert(props, ref) {
  return (
    <MuiAlert 
      elevation={6} 
      ref={ref} 
      variant="filled" // 'filled' variant works well in both light and dark modes
      {...props} 
    />
  );
});

function SnackbarAlert() {
  const { snackbar, hideSnackbar } = useSnackbar();
  
  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    hideSnackbar();
  };

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={snackbar.autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ mb: 2, mr: 2 }}
    >
      <Alert 
        onClose={handleClose} 
        severity={snackbar.severity}
        sx={{ 
          width: '100%',
          // Use Material UI's default colors regardless of theme
          "&.MuiAlert-root": {
            // No custom color overrides
          }
        }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}

export default SnackbarAlert;
