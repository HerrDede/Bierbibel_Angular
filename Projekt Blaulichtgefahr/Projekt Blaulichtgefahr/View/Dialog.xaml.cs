using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace Projekt_Blaulichtgefahr.View
{
    /// <summary>
    /// Interaktionslogik für Dialog.xaml
    /// </summary>
    public partial class Dialog : Window
    {        
        public Dialog()
        {
            InitializeComponent();
                       
        }

        private void btnDialogOk_Click(object sender, RoutedEventArgs e)
        {
            this.DialogResult = true;
        }

        private void Window_ContentRendered(object sender, EventArgs e)
        {
            txtAnswer.SelectAll();
            txtAnswer2.SelectAll();
            txtAnswer.Focus();
            txtAnswer2.Focus();
        }

        public string Answer1
        {
            get { return txtAnswer.Text; }
        }
        public string Answer2
        {
            get { return txtAnswer2.Text; }
        }
        public bool CheckboxStatus1
        {
            get { return lblCheck1.IsChecked ?? false; /* Wenn der Wert null ist, wird false zurückgegeben*/}
        }
        public bool CheckboxStatus2
        {
            get { return lblCheck2.IsChecked ?? false; /* Wenn der Wert null ist, wird false zurückgegeben*/}
        }
    }
}
