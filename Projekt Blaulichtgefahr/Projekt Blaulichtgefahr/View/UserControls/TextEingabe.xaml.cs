using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;

namespace Projekt_Blaulichtgefahr.View.UserControls
{
    /// <summary>
    /// Interaktionslogik für TextEingabe.xaml
    /// </summary>
    public partial class TextEingabe : UserControl, INotifyPropertyChanged
    {
        public TextEingabe()
        {
            DataContext = this;
            InitializeComponent();
        }

        private string placeholder;

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Placeholder
        {
            get { return placeholder; }
            set 
            { 
                placeholder = value;
                OnPropertyChanged();
            }
        }


        private void txtEingabe_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (string.IsNullOrEmpty(txtEingabe.Text))
                txtPlaceholder.Visibility = Visibility.Visible;
            else
                txtPlaceholder.Visibility = Visibility.Hidden;

        }

        private void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
